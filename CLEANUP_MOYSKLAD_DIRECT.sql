-- Очистка старых записей МойСклад Direct интеграции
-- Выполнить на сервере перед созданием новой интеграции

-- Проверить существующие записи
SELECT * FROM moysklad_direct_integrations WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t';

-- Удалить логи синхронизации (если есть)
DELETE FROM moysklad_direct_sync_logs 
WHERE integration_id IN (
  SELECT id FROM moysklad_direct_integrations 
  WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t'
);

-- Удалить интеграцию
DELETE FROM moysklad_direct_integrations 
WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t';

-- Проверить что удалено
SELECT * FROM moysklad_direct_integrations WHERE project_id = 'cmmf0rf0j00049eh2d926hx3t';
