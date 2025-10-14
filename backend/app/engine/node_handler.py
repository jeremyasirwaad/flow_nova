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
    next_nodes = get_next_nodes(ctx.workflow, node["id"], return_nodes=False)
    return ctx, next_nodes


def if_else_handler(node, ctx):
    print("running if_else_handler")
    cond = True
    if cond:
        next_nodes = get_next_nodes(
            ctx.workflow, node["id"], outcome="true", return_nodes=False
        )
        return ctx, next_nodes
    else:
        next_nodes = get_next_nodes(
            ctx.workflow, node["id"], outcome="false", return_nodes=False
        )
        return ctx, next_nodes


def agent_handler(node, ctx):
    print("running agent_handler")
    next_nodes = get_next_nodes(ctx.workflow, node["id"], return_nodes=False)
    return ctx, next_nodes


def guardrails_handler(node, ctx):
    print("guardrails handler")
    next_nodes = get_next_nodes(ctx.workflow, node["id"], return_nodes=False)
    return ctx, next_nodes

handlers = {"start": start_handler, "if_else": if_else_handler, "agent": agent_handler, "guardrails": guardrails_handler}
