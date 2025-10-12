{
  description = "FlowNova development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Python 3.12 with FastAPI and common dependencies
        pythonEnv = pkgs.python312.withPackages (ps: with ps; [
          # FastAPI and related
          fastapi
          uvicorn
          pydantic
          pydantic-settings
          python-multipart
          python-jose
          passlib

          # Database
          psycopg2
          sqlalchemy
          alembic
          asyncpg

          # Redis
          redis

          # HTTP clients
          httpx
          requests

          # Testing
          pytest
          pytest-asyncio
          pytest-cov

          # Linting/Formatting
          black
          flake8
          mypy
          ruff

          # Utilities
          python-dotenv
          click
          rich
          loguru
        ]);

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Python environment
            pythonEnv

            # Node.js for React frontend
            nodejs_20
            nodePackages.npm
            nodePackages.pnpm
            nodePackages.yarn

            # Task runner
            just

            # Docker
            docker
            docker-compose

            # Database clients
            postgresql_16
            redis

            # Development tools
            git
            curl
            wget
            jq

            # Code quality
            pre-commit

            # Monitoring tools
            grafana-loki
          ];

          shellHook = ''
            echo "🚀 FlowNova Development Environment"
            echo "=================================="
            echo "Python: $(python --version)"
            echo "Node: $(node --version)"
            echo "npm: $(npm --version)"
            echo "just: $(just --version)"
            echo ""
            echo "Available commands:"
            echo "  just --list    - Show all available tasks"
            echo "  just setup     - Initial project setup"
            echo "  just dev       - Start development environment"
            echo ""

            # Set up environment
            export PYTHONPATH="$PWD/backend:$PYTHONPATH"
            export NODE_ENV="development"

            # Load .env if it exists
            if [ -f .env ]; then
              set -a
              source .env
              set +a
            fi
          '';
        };
      }
    );
}
