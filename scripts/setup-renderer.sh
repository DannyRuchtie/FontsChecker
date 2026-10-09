#!/bin/sh
set -eu
python3 -m venv .renderer
.renderer/bin/python -m pip install -r scripts/requirements.txt
