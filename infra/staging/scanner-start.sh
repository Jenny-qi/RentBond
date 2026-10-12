#!/bin/sh
set -eu
# Never start with an empty or stale signature database after an update failure.
freshclam --stdout
freshclam --daemon --foreground --stdout &
exec clamd --foreground --config-file=/etc/clamav/clamd.conf
