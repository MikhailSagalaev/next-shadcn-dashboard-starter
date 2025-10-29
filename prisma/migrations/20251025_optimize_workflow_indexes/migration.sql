-- Улучшение производительности запросов мониторинга workflow

-- Индекс для доступа к логам конкретного выполнения в порядке времени
CREATE INDEX IF NOT EXISTS "workflow_logs_execution_id_timestamp_idx"
  ON "workflow_logs"("execution_id", "timestamp" DESC);

-- Индекс для аналитики выполнений по проекту и статусу
CREATE INDEX IF NOT EXISTS "workflow_executions_project_status_started_idx"
  ON "workflow_executions"("project_id", "status", "started_at" DESC);

-- Индекс для быстрых выборок по workflow и дате запуска
CREATE INDEX IF NOT EXISTS "workflow_executions_workflow_started_idx"
  ON "workflow_executions"("workflow_id", "started_at" DESC);

