FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends clamav-daemon clamav-freshclam clamdscan ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY infra/staging/clamd.conf /etc/clamav/clamd.conf
COPY infra/staging/scanner-start.sh /usr/local/bin/rentbond-scanner
RUN mkdir -p /var/lib/clamav /var/log/clamav && chown -R clamav:clamav /var/lib/clamav /var/log/clamav
USER clamav
ENV TZ=UTC
ENTRYPOINT ["sh", "/usr/local/bin/rentbond-scanner"]
