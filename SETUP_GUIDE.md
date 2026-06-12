# Vaultr Database Backup & Restore Guide

This guide covers how to back up and restore the PostgreSQL database and MinIO storage, ensuring zero downtime and preventing data loss.

## Database (PostgreSQL)

### Backup
To create a backup of the PostgreSQL database, use the `pg_dump` command via the docker container:
```bash
docker compose exec postgres pg_dump -U postgres vaultr > vaultr_db_backup_$(date +%F).sql
```
This creates a raw SQL backup file locally.

### Restore
To restore from a backup:
```bash
# 1. Drop existing connections and database if necessary
docker compose exec postgres psql -U postgres -c "DROP DATABASE vaultr WITH (FORCE);"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE vaultr;"

# 2. Import the backup file
cat vaultr_db_backup_YYYY-MM-DD.sql | docker compose exec -T postgres psql -U postgres vaultr
```

## MinIO (Storage)

### Backup
Since MinIO stores data directly to the local filesystem (mapped to `./storage` by default in `docker-compose.yml`), you can simply back up that directory:
```bash
tar -czvf vaultr_storage_backup_$(date +%F).tar.gz ./storage
```

### Restore
Extract the backup archive over the existing storage folder:
```bash
tar -xzvf vaultr_storage_backup_YYYY-MM-DD.tar.gz
```

*Note: Restarting the MinIO container might be necessary to immediately reflect newly restored files.*
```bash
docker compose restart minio
```
