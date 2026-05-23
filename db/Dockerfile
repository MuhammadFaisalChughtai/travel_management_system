FROM mysql:8.0

# Add the database schema to the initialization directory
# MySQL will automatically execute any .sql scripts found in this directory on first boot
COPY database_schema.sql /docker-entrypoint-initdb.d/schema.sql
