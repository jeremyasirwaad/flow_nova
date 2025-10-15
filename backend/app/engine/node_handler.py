def get_next_nodes(
    workflow: dict, node_id: str, *, outcome=None, return_nodes: bool = False
):
    """
    Return the list of next nodes (or node_ids) reachable from `node_id`.

    Params
    ------
    workflow: dict            # your workflow JSON/dict
    node_id: str              # current node id
    outcome: bool|str|None    # for branched edges: True/'true', False/'false', or any handle string
    return_nodes: bool        # if True, return node dicts; else return node ids

    Notes
    -----
    - If `outcome` is None, returns all outgoing targets regardless of handle.
    - If `outcome` is provided, only edges whose `source_handle` matches are followed.
    """
    edges = workflow.get("edges", [])
    nodes = workflow.get("nodes", {})

    # Normalize the outcome to a comparable string handle if provided
    norm = None
    if outcome is not None:
        if isinstance(outcome, bool):
            norm = "true" if outcome else "false"
        else:
            norm = str(outcome).strip().lower()

    next_ids = []
    for e in edges:
        if e.get("source") != node_id:
            continue
        handle = e.get("source_handle")
        handle_norm = None if handle is None else str(handle).strip().lower()

        if norm is None or handle_norm == norm:
            tgt = e.get("target")
            if tgt is not None:
                next_ids.append(tgt)

    # De-duplicate while preserving order
    seen = set()
    next_ids = [i for i in next_ids if not (i in seen or seen.add(i))]

    if return_nodes:
        return [nodes.get(i) for i in next_ids if i in nodes]
    return next_ids


def start_handler(node, ctx):
    print("running start handler")

    # Import here to avoid circular dependency
    from app.engine.engine import create_ledger_entry

    # Create ledger entry for start node execution
    if ctx.run_id:
        create_ledger_entry(
            workflow_id=ctx.workflow["id"],
            node_id=node["id"],
            run_id=ctx.run_id,
            node_type=node["type"],
            input_json=ctx.input,
            output_json=ctx.output,
        )

    next_nodes = get_next_nodes(ctx.workflow, node["id"], return_nodes=False)
    ctx.output = ctx.input
    return ctx, next_nodes


def extract_variable_value(variable_str: str, ctx):
    """
    Extract value from variable string with {{}} placeholder.
    Example: "{{input.type}}" -> extracts ctx.input["type"]
    """
    import re

    # Check if the string contains {{}} placeholder
    match = re.match(r"\{\{(.+?)\}\}", variable_str.strip())
    if not match:
        # If no placeholder, return the value as-is
        return variable_str

    # Extract the path (e.g., "input.type")
    path = match.group(1).strip()
    parts = path.split(".")

    # Navigate through the context
    try:
        if parts[0] == "input":
            value = ctx.input
            for part in parts[1:]:
                value = value[part]
            return value
        elif parts[0] == "output":
            value = ctx.output
            for part in parts[1:]:
                value = value[part]
            return value
        else:
            raise KeyError(f"Unknown context root: {parts[0]}")
    except (KeyError, TypeError) as e:
        raise ValueError(f"Failed to extract value from '{variable_str}': {str(e)}")


def evaluate_condition(lhs_value, rhs_value, operator: str) -> bool:
    """
    Evaluate condition based on operator.
    Supported operators: =, !=, <, >, <=, >=
    """
    try:
        # Try to convert to numbers if possible for numeric comparison
        try:
            lhs_num = float(lhs_value)
            rhs_num = float(rhs_value)
            lhs_value = lhs_num
            rhs_value = rhs_num
        except (ValueError, TypeError):
            # Keep as strings if conversion fails
            pass

        if operator == "=":
            return lhs_value == rhs_value
        elif operator == "!=":
            return lhs_value != rhs_value
        elif operator == "<":
            return lhs_value < rhs_value
        elif operator == ">":
            return lhs_value > rhs_value
        elif operator == "<=":
            return lhs_value <= rhs_value
        elif operator == ">=":
            return lhs_value >= rhs_value
        else:
            raise ValueError(f"Unsupported operator: {operator}")
    except Exception as e:
        raise ValueError(f"Failed to evaluate condition: {str(e)}")


def if_else_handler(node, ctx):
    print("running if_else_handler")

    # Import here to avoid circular dependency
    from app.engine.engine import create_ledger_entry

    try:
        # Extract node data
        node_data = node.get("data", {})
        lhs = node_data.get("lhs", "")
        rhs = node_data.get("rhs", "")
        condition = node_data.get("condition", "=")

        # Extract actual values from placeholders
        lhs_value = extract_variable_value(lhs, ctx)
        rhs_value = extract_variable_value(rhs, ctx)

        # Evaluate the condition
        result = evaluate_condition(lhs_value, rhs_value, condition)

        # Store the result in output
        ctx.output = {
            **ctx.input,  # Copy input to output
            "condition": result,
            "lhs_value": lhs_value,
            "rhs_value": rhs_value,
            "operator": condition,
        }

        # Get next nodes based on condition result
        if result:
            next_nodes = get_next_nodes(
                ctx.workflow, node["id"], outcome="true", return_nodes=False
            )
        else:
            next_nodes = get_next_nodes(
                ctx.workflow, node["id"], outcome="false", return_nodes=False
            )

        # Create ledger entry after processing
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
            )

        return ctx, next_nodes

    except Exception as e:
        # Handle errors gracefully
        error_message = str(e)
        ctx.output = {
            "error": error_message,
            "success": False,
            "reason": "Workflow execution failed in if_else node",
        }

        # Still create ledger entry to track the failure
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
            )

        # Return empty next_nodes to stop execution
        return ctx, []


def convert_tool_to_litellm_format(tool) -> dict:
    """
    Convert a Tool database model to LiteLLM tool format.

    Args:
        tool: Tool model from database

    Returns:
        dict in LiteLLM format
    """
    # Convert parameters array to properties dict
    properties = {}
    required = []

    if tool.parameters:
        for param in tool.parameters:
            param_name = param.get("name")
            param_desc = param.get("description", "")

            properties[param_name] = {
                "type": "string",  # Default to string, could be enhanced later
                "description": param_desc,
            }
            required.append(param_name)

    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


def execute_tool_call(tool, arguments: dict) -> str:
    """
    Execute a tool by making HTTP request to its API.

    Args:
        tool: Tool model from database
        arguments: Dict of arguments from LLM tool call

    Returns:
        str: Response from the API call
    """
    import requests
    import json

    try:
        # Prepare request
        url = tool.api_url
        method = tool.method.upper()
        headers = tool.headers or {}

        # Build request based on method
        if method == "GET":
            # For GET requests, add arguments as query parameters
            response = requests.get(url, params=arguments, headers=headers, timeout=30)
        elif method == "POST":
            # For POST requests, send arguments in body
            response = requests.post(url, json=arguments, headers=headers, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=arguments, headers=headers, timeout=30)
        elif method == "DELETE":
            response = requests.delete(
                url, params=arguments, headers=headers, timeout=30
            )
        else:
            return f"Error: Unsupported HTTP method {method}"

        # Return response
        if response.status_code >= 200 and response.status_code < 300:
            try:
                return json.dumps(response.json())
            except:
                return response.text
        else:
            return f"Error: API returned status code {response.status_code}: {response.text}"

    except Exception as e:
        return f"Error executing tool: {str(e)}"


def agent_handler(node, ctx):
    print("running agent_handler")

    from app.engine.engine import create_ledger_entry
    from app.core.config import get_settings
    from app.core.database import get_db
    from app.models.tool import Tool
    from litellm import completion
    import os
    import json

    try:
        settings = get_settings()
        node_data = node.get("data", {})

        # Set up environment variables for API key
        if settings.models_service_api_key:
            os.environ["OPENAI_API_KEY"] = settings.models_service_api_key
        if settings.models_service_url:
            os.environ["OPENAI_API_BASE"] = settings.models_service_url

        # Extract node configuration
        system_prompt_template = node_data.get("system_prompt", "")
        user_prompt_template = node_data.get("user_prompt", "")
        llm_model = node_data.get("llm_model", "gemini/gemini-2.5-pro")
        tool_ids = node_data.get("tools", [])
        structured_output = node_data.get("structured_output", False)
        structured_output_schema = node_data.get("structured_output_schema", "")

        # Replace variables in prompts
        system_prompt = replace_variables_in_text(system_prompt_template, ctx)
        user_prompt = replace_variables_in_text(user_prompt_template, ctx)

        # Handle structured output
        if structured_output and structured_output_schema:
            system_prompt += f"\n\nOutput format (**ONLY JSON**):\n```json\n{structured_output_schema}\n```"

        # Fetch tools from database if tool_ids provided
        tools_litellm_format = []
        tools_map = {}  # Map tool name to tool object

        if tool_ids:
            from app.core.database import SyncSessionLocal

            db = SyncSessionLocal()
            try:
                for tool_id in tool_ids:
                    tool = db.query(Tool).filter(Tool.id == tool_id).first()
                    if tool:
                        tools_litellm_format.append(
                            convert_tool_to_litellm_format(tool)
                        )
                        tools_map[tool.name] = tool
            finally:
                db.close()

        # Build initial messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Make initial LLM call
        completion_kwargs = {
            "model": llm_model,
            "messages": messages,
            "api_base": settings.models_service_url.replace("/v1/models", ""),
            "custom_llm_provider": "openai",
        }

        if tools_litellm_format:
            completion_kwargs["tools"] = tools_litellm_format

        print(f"Completion kwargs: {completion_kwargs}")
        response = completion(**completion_kwargs)
        print(f"Response: {response}")

        # Check if there are tool calls
        assistant_message = response.choices[0].message

        # Track tool calls for ledger
        tool_calls_info = None

        # Handle tool calls if present
        if hasattr(assistant_message, "tool_calls") and assistant_message.tool_calls:
            # Store tool call information
            tool_calls_info = {
                "has_tool_calls": True,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "function_name": tc.function.name,
                        "function_arguments": json.loads(tc.function.arguments),
                        "tool_response": None,  # Will be filled below
                    }
                    for tc in assistant_message.tool_calls
                ],
            }

            # Add assistant message to conversation
            messages.append(
                {
                    "role": "assistant",
                    "content": assistant_message.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in assistant_message.tool_calls
                    ],
                }
            )

            # Execute each tool call
            for idx, tool_call in enumerate(assistant_message.tool_calls):
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)

                # Get tool from map and execute
                tool = tools_map.get(function_name)
                if tool:
                    tool_response = execute_tool_call(tool, function_args)
                else:
                    tool_response = f"Error: Tool {function_name} not found"

                # Store tool response in tracking info
                tool_calls_info["tool_calls"][idx]["tool_response"] = tool_response

                # Add tool response to messages
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_response,
                    }
                )

            # Make second LLM call with tool results
            response = completion(**completion_kwargs)
            final_content = response.choices[0].message.content
        else:
            final_content = assistant_message.content
            tool_calls_info = {"has_tool_calls": False}

        # Process output based on structured_output flag
        if structured_output:
            try:
                parsed_output = parse_llm_json_response(final_content)
                ctx.output = {**ctx.input, **parsed_output}
            except Exception as e:
                # If parsing fails, fall back to simple message format
                ctx.output = {
                    **ctx.input,
                    "message": final_content,
                    "parse_error": str(e),
                }
        else:
            ctx.output = {**ctx.input, "message": final_content}

        next_nodes = get_next_nodes(ctx.workflow, node["id"], return_nodes=False)

        # Create ledger entry after processing
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
                tool_calls=tool_calls_info,
            )

        return ctx, next_nodes

    except Exception as e:
        # Handle errors gracefully
        error_message = str(e)
        ctx.output = {
            "error": error_message,
            "success": False,
            "reason": "Workflow execution failed in agent node",
        }

        # Still create ledger entry to track the failure
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
                tool_calls=None,
            )

        # Return empty next_nodes to stop execution
        return ctx, []


def replace_variables_in_text(text: str, ctx) -> str:
    """
    Replace all {{}} placeholders in a text string with actual values.
    Example: "transcript: {{input.transcript}}" -> "transcript: <actual transcript>"
    """
    import re

    # Find all {{...}} patterns in the text
    pattern = r"\{\{[^}]+\}\}"
    matches = re.findall(pattern, text)

    result = text
    for match in matches:
        try:
            # Extract the value using our existing function
            value = extract_variable_value(match, ctx)
            # Replace the placeholder with the actual value
            result = result.replace(match, str(value))
        except Exception as e:
            # If extraction fails, keep the placeholder as-is or raise error
            raise ValueError(f"Failed to replace variable {match}: {str(e)}")

    return result


def parse_llm_json_response(content: str) -> dict:
    """
    Parse LLM response that may contain JSON wrapped in markdown code blocks.
    Removes ```json and ``` markers if present.
    """
    import json
    import re

    # Remove markdown code block markers
    # Pattern matches: ```json{...}``` or ```{...}```
    content = content.strip()

    # Remove leading ```json or ```
    content = re.sub(r"^```json\s*", "", content)
    content = re.sub(r"^```\s*", "", content)

    # Remove trailing ```
    content = re.sub(r"\s*```$", "", content)

    # Clean up the content
    content = content.strip()

    # Parse JSON
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Failed to parse JSON from LLM response: {str(e)}\nContent: {content}"
        )


def guardrails_handler(node, ctx):
    from datetime import datetime
    now = datetime.now()
    formatted = now.strftime("%Y-%m-%d %H:%M:%S")
    print("Formatted:", formatted)

    # Import here to avoid circular dependency
    from app.engine.engine import create_ledger_entry
    from app.core.config import get_settings
    from litellm import completion
    import os

    try:
        settings = get_settings()

        # Set up environment variables for API key and base URL
        if settings.models_service_api_key:
            os.environ["OPENAI_API_KEY"] = settings.models_service_api_key

        # Configure litellm to use the custom base URL
        if settings.models_service_url:
            os.environ["OPENAI_API_BASE"] = settings.models_service_url

        # Extract guardrail prompt from node data
        node_data = node.get("data", {})
        guardrail_template = node_data.get("guardrail", "")

        # Replace variables in the guardrail text
        user_prompt = replace_variables_in_text(guardrail_template, ctx)

        system_prompt = """You are a professional guardrail engineer. You are given a guardrail and a user prompt. You need to check if the user prompt satisfies the guardrail.

Output format (**ONLY JSON**):
```json
{
    "guardrail_result": "fail|pass",
    "reason": "Reason for guardrail fail or pass"
}```"""

        # Make LLM call with custom base URL
        # Using gemini/gemini-2.5-pro model with OpenAI-compatible endpoint
        response = completion(
            model="gemini/gemini-2.5-pro",
            messages=[
                {"content": system_prompt, "role": "system"},
                {"content": user_prompt, "role": "user"},
            ],
            api_base=settings.models_service_url.replace("/v1/models", ""),
            custom_llm_provider="openai",
        )

        # Extract the response content
        llm_response_content = response.choices[0].message.content

        # Parse the JSON response
        llm_result = parse_llm_json_response(llm_response_content)

        # Get the guardrail result and normalize to lowercase
        guardrail_result = llm_result.get("guardrail_result", "").lower()

        # Update context output with input + LLM response
        ctx.output = {
            **ctx.input,  # Copy all input data
            "guardrail_result": guardrail_result,
            "guardrail_reason": llm_result.get("reason"),
        }

        # Get next nodes based on guardrail result (pass or fail)
        # The outcome will be "pass" or "fail" matching the source_handle
        next_nodes = get_next_nodes(
            ctx.workflow, node["id"], outcome=guardrail_result, return_nodes=False
        )

        # Create ledger entry after processing
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
            )

        return ctx, next_nodes

    except Exception as e:
        # Handle errors gracefully
        error_message = str(e)
        ctx.output = {
            "error": error_message,
            "success": False,
            "reason": "Workflow execution failed in guardrails node",
        }

        # Still create ledger entry to track the failure
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
            )

        # Return empty next_nodes to stop execution
        return ctx, []


def user_approval_handler(node, ctx):
    """
    Handler for user approval nodes that pauses workflow execution.

    This node has two execution phases:
    1. First execution: Pauses workflow and waits for user decision
    2. Second execution: Resumes workflow based on user's yes/no decision
    """
    print("running user_approval_handler")

    # Import here to avoid circular dependency
    from app.engine.engine import create_ledger_entry
    from app.core.event_publisher import get_event_publisher
    from uuid import UUID

    try:
        node_data = node.get("data", {})

        # Check if this is a resume (user has made a decision)
        user_decision = ctx.input.get("user_decision")

        if user_decision is None:
            # PHASE 1: PAUSE - No decision yet, waiting for user approval
            print(f"User approval node {node['id']} is waiting for user input")

            # Extract approval message from node configuration
            approval_message = node_data.get(
                "approval_message",
                "Do you want to continue with this workflow?"
            )

            # Create ledger entry with waiting status
            if ctx.run_id:
                create_ledger_entry(
                    workflow_id=ctx.workflow["id"],
                    node_id=node["id"],
                    run_id=ctx.run_id,
                    node_type=node["type"],
                    input_json=ctx.input,
                    output_json={
                        "status": "waiting_for_approval",
                        "message": approval_message
                    },
                )

            # Publish WebSocket event to notify frontend
            try:
                publisher = get_event_publisher()
                publisher.publish_approval_needed(
                    run_id=ctx.run_id,
                    workflow_id=UUID(ctx.workflow["id"]),
                    node_id=UUID(node["id"]),
                    message=approval_message
                )
            except Exception as e:
                print(f"Failed to publish approval_needed event: {e}")

            # CRITICAL: Return empty next_nodes to PAUSE execution
            ctx.output = {
                **ctx.input,
                "status": "waiting_for_approval",
                "message": approval_message
            }
            return ctx, []

        else:
            # PHASE 2: RESUME - User has made a decision, continue execution
            print(f"User approval node {node['id']} received decision: {user_decision}")

            # Normalize decision to yes/no
            normalized_decision = "yes" if str(user_decision).lower() in ["yes", "approve", "approved", "true"] else "no"

            # Update context output with decision
            ctx.output = {
                **ctx.input,
                "user_decision": normalized_decision,
                "approved": normalized_decision == "yes",
                "status": "completed"
            }

            # Create ledger entry with final decision
            if ctx.run_id:
                create_ledger_entry(
                    workflow_id=ctx.workflow["id"],
                    node_id=node["id"],
                    run_id=ctx.run_id,
                    node_type=node["type"],
                    input_json=ctx.input,
                    output_json=ctx.output,
                )

            # Get next nodes based on user decision (yes or no handle)
            next_nodes = get_next_nodes(
                ctx.workflow,
                node["id"],
                outcome=normalized_decision,
                return_nodes=False
            )

            print(f"User approval continuing to next nodes: {next_nodes}")
            return ctx, next_nodes

    except Exception as e:
        # Handle errors gracefully
        error_message = str(e)
        print(f"Error in user_approval_handler: {error_message}")
        ctx.output = {
            "error": error_message,
            "success": False,
            "reason": "Workflow execution failed in user_approval node",
        }

        # Still create ledger entry to track the failure
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
            )

        # Return empty next_nodes to stop execution on error
        return ctx, []


def fork_handler(node, ctx):
    """
    Handler for fork nodes that enable parallel branching.

    The fork node splits execution into multiple parallel branches.
    All branches receive the same input and execute concurrently.
    """
    print("running fork_handler")

    # Import here to avoid circular dependency
    from app.engine.engine import create_ledger_entry

    try:
        # Pass input to output unchanged
        ctx.output = {**ctx.input}

        # Get ALL outgoing nodes (parallel execution)
        # outcome=None means get all edges regardless of source_handle
        next_nodes = get_next_nodes(
            ctx.workflow,
            node["id"],
            outcome=None,  # Get all branches
            return_nodes=False
        )

        print(f"Fork node {node['id']} splitting into {len(next_nodes)} branches: {next_nodes}")

        # Create ledger entry
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json={
                    **ctx.output,
                    "branches": next_nodes,
                    "branch_count": len(next_nodes)
                },
            )

        # Return all next nodes for parallel execution
        return ctx, next_nodes

    except Exception as e:
        # Handle errors gracefully
        error_message = str(e)
        print(f"Error in fork_handler: {error_message}")
        ctx.output = {
            "error": error_message,
            "success": False,
            "reason": "Workflow execution failed in fork node",
        }

        # Still create ledger entry to track the failure
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
            )

        # Return empty next_nodes to stop execution on error
        return ctx, []


def validate_virtual_workflow(workflow_json: dict) -> tuple[bool, str]:
    """
    Validate a generated virtual workflow.

    Returns:
        (is_valid, error_message)
    """
    # Check required keys
    if "nodes" not in workflow_json:
        return False, "Missing 'nodes' key in workflow"
    if "edges" not in workflow_json:
        return False, "Missing 'edges' key in workflow"

    nodes = workflow_json["nodes"]
    edges = workflow_json["edges"]

    # Check max nodes limit
    if len(nodes) > 20:
        return False, f"Too many nodes: {len(nodes)} (max 20)"

    if len(nodes) == 0:
        return False, "Workflow must have at least one node"

    # Validate each node
    allowed_types = ["agent", "if_else", "guardrails"]
    node_ids = set()

    for node in nodes:
        # Check required keys
        if "id" not in node:
            return False, "Node missing 'id' field"
        if "data" not in node:
            return False, f"Node {node.get('id')} missing 'data' field"

        node_id = node["id"]
        node_ids.add(node_id)
        node_data = node["data"]

        # Check node type
        node_type = node_data.get("type")
        if not node_type:
            return False, f"Node {node_id} missing 'type' in data"

        if node_type not in allowed_types:
            return False, f"Node {node_id} has disallowed type '{node_type}'. Allowed: {allowed_types}"

    # Validate edges
    for edge in edges:
        if "source" not in edge or "target" not in edge:
            return False, "Edge missing 'source' or 'target'"

        source = edge["source"]
        target = edge["target"]

        # Check that source and target nodes exist
        if source not in node_ids:
            return False, f"Edge references non-existent source node: {source}"
        if target not in node_ids:
            return False, f"Edge references non-existent target node: {target}"

    # Check for cycles (simple DFS)
    # Build adjacency list
    adj = {nid: [] for nid in node_ids}
    for edge in edges:
        adj[edge["source"]].append(edge["target"])

    # DFS to detect cycles
    visited = set()
    rec_stack = set()

    def has_cycle(node_id):
        visited.add(node_id)
        rec_stack.add(node_id)

        for neighbor in adj.get(node_id, []):
            if neighbor not in visited:
                if has_cycle(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True

        rec_stack.remove(node_id)
        return False

    for node_id in node_ids:
        if node_id not in visited:
            if has_cycle(node_id):
                return False, "Workflow contains cycles (not a DAG)"

    return True, ""


def find_entry_node(nodes: list, edges: list) -> dict:
    """
    Find the entry node (node with no incoming edges).

    Returns:
        Entry node dict or None
    """
    node_ids = {n["id"] for n in nodes}
    target_ids = {e["target"] for e in edges}

    # Entry nodes have no incoming edges
    entry_ids = node_ids - target_ids

    if not entry_ids:
        raise ValueError("No entry node found (all nodes have incoming edges)")

    if len(entry_ids) > 1:
        # Multiple entry points - pick the first one
        print(f"Warning: Multiple entry nodes found: {entry_ids}. Using first.")

    entry_id = list(entry_ids)[0]
    for node in nodes:
        if node["id"] == entry_id:
            return node

    return None


def execute_virtual_node(virtual_node: dict, ctx, virtual_workflow: dict, nodes_dict: dict):
    """
    Execute a single virtual node using the appropriate handler.

    Args:
        virtual_node: The node to execute
        ctx: Execution context
        virtual_workflow: Virtual workflow dict with nodes as array (for edges lookup)
        nodes_dict: Nodes converted to dict format {node_id: node} for get_next_nodes()

    Returns:
        (updated_ctx, outcome) where outcome is the result for branching nodes
    """
    node_type = virtual_node["data"].get("type")

    print(f"Executing virtual node {virtual_node['id']} of type {node_type}")

    # Get the handler for this node type
    handler = handlers.get(node_type)
    if not handler:
        raise ValueError(f"No handler found for node type: {node_type}")

    # Transform node structure: LLM generates {data: {type: "..."}}
    # but handlers expect {type: "...", data: {...}}
    transformed_node = {
        "id": virtual_node["id"],
        "type": node_type,  # Move type to top level
        "data": {k: v for k, v in virtual_node["data"].items() if k != "type"}
    }

    # Create a temporary workflow context for the virtual node
    # Use nodes_dict format that get_next_nodes() expects
    workflow_for_handler = {
        "nodes": nodes_dict,  # Dict format: {node_id: node}
        "edges": virtual_workflow["edges"],
        "id": ctx.workflow["id"]
    }

    # Create temp context WITHOUT run_id so handlers don't create ledger entries
    # (virtual nodes aren't in DB, would violate FK constraint)
    temp_ctx = type('obj', (object,), {
        'workflow': workflow_for_handler,
        'input': ctx.input,
        'output': ctx.output,
        'run_id': None,  # ❌ Don't let handlers create ledger entries for virtual nodes
    })()

    # Execute the handler with transformed node (without following next_nodes)
    updated_ctx, next_nodes = handler(transformed_node, temp_ctx)

    # Update original context
    ctx.output = updated_ctx.output

    # For branching nodes, determine outcome
    outcome = None
    if node_type == "if_else":
        outcome = "true" if updated_ctx.output.get("condition") else "false"
    elif node_type == "guardrails":
        outcome = updated_ctx.output.get("guardrail_result", "fail")

    return ctx, outcome


def execute_virtual_workflow(virtual_workflow: dict, ctx) -> dict:
    """
    Execute a virtual workflow sequentially.

    Returns:
        Final output dict
    """
    from app.engine.engine import create_ledger_entry

    nodes = virtual_workflow["nodes"]
    edges = virtual_workflow["edges"]

    # Build node lookup dict (for get_next_nodes compatibility)
    nodes_map = {n["id"]: n for n in nodes}

    # Find entry node
    current_node = find_entry_node(nodes, edges)
    if not current_node:
        raise ValueError("Could not find entry node in virtual workflow")

    # Track execution path for debugging
    execution_path = []
    max_iterations = 50  # Safety limit
    iteration = 0

    while current_node and iteration < max_iterations:
        iteration += 1
        node_id = current_node["id"]
        node_type = current_node["data"].get("type")

        print(f"Virtual workflow step {iteration}: Executing node {node_id} ({node_type})")
        execution_path.append(node_id)

        # Execute this node (pass nodes_map for handler compatibility)
        ctx, outcome = execute_virtual_node(current_node, ctx, virtual_workflow, nodes_map)

        # Create ledger entry for virtual node
        # Note: We can't use node_id directly (FK constraint), so we skip ledger for now
        # In production, you'd want to either:
        # 1. Store virtual_workflow_ledger in a separate table
        # 2. Use the parent cognitive node_id for all virtual entries
        # 3. Make node_id nullable in workflow_ledger
        # For now, we track in cognitive node's output_json instead
        print(f"Virtual node {node_id} completed. Output: {ctx.output}")

        # Find next node based on outcome (for branching nodes)
        next_node_ids = []
        for edge in edges:
            if edge["source"] == node_id:
                # Check if source_handle matches outcome (for branching)
                source_handle = edge.get("source_handle")
                if outcome is None:
                    # No branching - take any edge
                    next_node_ids.append(edge["target"])
                elif source_handle and str(source_handle).lower() == str(outcome).lower():
                    # Branching - take matching edge
                    next_node_ids.append(edge["target"])

        # Move to next node (take first if multiple)
        if next_node_ids:
            current_node = nodes_map.get(next_node_ids[0])
            # Update input for next node
            ctx.input = ctx.output
        else:
            # No more nodes - workflow complete
            current_node = None

    if iteration >= max_iterations:
        raise ValueError("Virtual workflow exceeded max iterations (possible infinite loop)")

    print(f"Virtual workflow completed. Execution path: {execution_path}")
    return ctx.output


def cognitive_handler(node, ctx):
    """
    Handler for cognitive nodes that generate and execute workflows at runtime.

    The cognitive node:
    1. Takes a natural language instruction (cognitive_instruction)
    2. Calls an LLM to generate a workflow (nodes + edges)
    3. Validates the generated workflow
    4. Executes it sequentially
    5. Returns the final output
    """
    print("running cognitive_handler")

    from app.engine.engine import create_ledger_entry
    from app.core.config import get_settings
    from litellm import completion
    import os
    import json

    try:
        settings = get_settings()
        node_data = node.get("data", {})

        # Set up environment variables for API key
        if settings.models_service_api_key:
            os.environ["OPENAI_API_KEY"] = settings.models_service_api_key
        if settings.models_service_url:
            os.environ["OPENAI_API_BASE"] = settings.models_service_url

        # Extract cognitive instruction
        cognitive_instruction_template = node_data.get("cognitive_instruction", "")
        if not cognitive_instruction_template:
            raise ValueError("cognitive_instruction is required for cognitive node")

        # Interpolate variables in cognitive instruction (like {{input.transcript}})
        cognitive_instruction = replace_variables_in_text(cognitive_instruction_template, ctx)

        # Build the system prompt (battle-tested from user)
        system_prompt = """# Role
You are a professional workflow manager. Your job is to assemble a directed graph (nodes + edges) that executes a coherent flow.

# Objective
Given:
1) input_object
2) a list of available node templates (with names, types, and use-cases)

Produce a valid workflow JSON with instantiated nodes (new UUIDv4 ids) and edges that define execution order and branching.

The last nodes response would automatically be the output for the workflow

# Node Types & Schemas (exact keys; keep executionState="idle" unless specified)

## Agent Node
{
  "label": "Agent Node",
  "type": "agent",
  "llm_model": "gemini/gemini-2.5-pro",
  "description": "<what the agent does>",
  "user_prompt": "<user prompt>",
  "system_prompt": "<system prompt>",
  "executionState": "idle",
  "structured_output": <boolean>,
  "structured_output_schema": "<JSON schema string when structured_output=true, else empty string>"
}
Source handles: None

## Guardrails
{
  "label": "Guardrails",
  "type": "guardrails",
  "guardrail": "<check to perform>",
  "description": "<what is being validated>",
  "executionState": "idle"
}
Source handles: "pass", "fail"

## If/Else
{
  "label": "If/Else",
  "lhs": "<string>",
  "rhs": "<string>",
  "type": "if_else",
  "condition": "<= | >= | < | > | = | != | <=>",
  "description": "<what is being compared>",
  "executionState": "idle"
}
Source handles: "true", "false"

# Source Handle Rules (must cover all branches)
- Guardrails: both "pass" and "fail" must be wired.
- If/Else: both "true" and "false" must be wired.
- Agent Node: None

# Output Format (strict)
Return ONLY:
{
  "nodes": [
    {
      "id": "<uuid-v4>",
      "name": "<node name>",
      "data": { ...node schema... }
    }
    // additional nodes...
  ],
  "edges": [
    {
      "source": "<uuid-v4>",
      "target": "<uuid-v4>",
      "source_handle": "<handle string, source node spec>",
      "target_handle": null
    }
    // additional edges...
  ],
  "reasoning": "<str, reasoning for the workflow decision>"
}"""

        # Build user prompt with instruction + input context
        input_json_str = json.dumps(ctx.input, indent=2)
        user_prompt = f"""Instruction: {cognitive_instruction}

Input data available:
```json
{input_json_str}
```

Generate a workflow to accomplish this task."""

        # Call LLM to generate workflow
        print(f"Calling LLM to generate workflow for: {cognitive_instruction}")
        response = completion(
            model="gemini/gemini-2.5-pro",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            api_base=settings.models_service_url.replace("/v1/models", ""),
            custom_llm_provider="openai",
        )

        llm_response_content = response.choices[0].message.content
        print(f"LLM response: {llm_response_content[:500]}...")

        # Parse the JSON response
        workflow_json = parse_llm_json_response(llm_response_content)

        # Validate the generated workflow
        is_valid, error_msg = validate_virtual_workflow(workflow_json)
        if not is_valid:
            raise ValueError(f"Generated workflow is invalid: {error_msg}")

        print(f"Generated workflow is valid. Nodes: {len(workflow_json['nodes'])}, Edges: {len(workflow_json['edges'])}")

        # Execute the virtual workflow
        print("Starting virtual workflow execution...")
        final_output = execute_virtual_workflow(workflow_json, ctx)

        # Update context with final output
        ctx.output = {
            **final_output,
            "cognitive_reasoning": workflow_json.get("reasoning", ""),
            "generated_workflow": {
                "node_count": len(workflow_json["nodes"]),
                "edge_count": len(workflow_json["edges"]),
            }
        }

        # Get next nodes in main workflow
        next_nodes = get_next_nodes(ctx.workflow, node["id"], return_nodes=False)

        # Create ledger entry for cognitive node itself
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json={
                    **ctx.output,
                    "virtual_workflow": workflow_json,  # Store generated workflow
                },
            )

        print(f"Cognitive node completed. Moving to next nodes: {next_nodes}")
        return ctx, next_nodes

    except Exception as e:
        # Handle errors gracefully
        error_message = str(e)
        print(f"Error in cognitive_handler: {error_message}")
        ctx.output = {
            "error": error_message,
            "success": False,
            "reason": "Workflow execution failed in cognitive node",
        }

        # Still create ledger entry to track the failure
        if ctx.run_id:
            create_ledger_entry(
                workflow_id=ctx.workflow["id"],
                node_id=node["id"],
                run_id=ctx.run_id,
                node_type=node["type"],
                input_json=ctx.input,
                output_json=ctx.output,
            )

        # Return empty next_nodes to stop execution on error
        return ctx, []


handlers = {
    "start": start_handler,
    "if_else": if_else_handler,
    "agent": agent_handler,
    "guardrails": guardrails_handler,
    "user_approval": user_approval_handler,
    "fork": fork_handler,
    "cognitive": cognitive_handler,
}
