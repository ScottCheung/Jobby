#!/bin/bash
set -e

touch /root/.Xauthority
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99

# Wait for Xvfb to be ready
for _ in $(seq 1 30); do
    if xdpyinfo -display :99 >/dev/null 2>&1; then
        break
    fi
    sleep 0.2
done

case "${1:-bot}" in
    bot)
        exec python docker/run_bot.py
        ;;
    ui)
        exec python -c "from app import app; app.run(host='0.0.0.0', port=5000, debug=False)"
        ;;
    shell)
        exec /bin/bash
        ;;
    *)
        exec "$@"
        ;;
esac
