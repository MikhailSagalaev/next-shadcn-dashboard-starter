# Workflow Execution Monitoring System - Техническая спецификация

## 🎯 Обзор системы

Система мониторинга выполнения workflow для визуализации, отладки и анализа выполнения workflow в реальном времени, аналогично n8n, Make.com и другим workflow-платформам.

## 📋 Детальные задачи

### 1. API Endpoints для истории выполнения

#### 1.1 GET /api/projects/[id]/workflows/[workflowId]/executions
**Назначение**: Получение списка всех выполнений workflow с пагинацией и фильтрацией

**Параметры запроса**:
```typescript
interface ExecutionListParams {
  page?: number;           // Номер страницы (по умолчанию 1)
  limit?: number;          // Количество записей (по умолчанию 20, максимум 100)
  status?: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  userId?: string;         // Фильтр по пользователю
  dateFrom?: string;       // ISO дата начала
  dateTo?: string;         // ISO дата окончания
  search?: string;         // Поиск по sessionId или telegramChatId
}
```

**Ответ**:
```typescript
interface ExecutionListResponse {
  executions: {
    id: string;
    status: string;
    startedAt: Date;
    finishedAt?: Date;
    duration?: number;      // в миллисекундах
    userId?: string;
    telegramChatId?: string;
    currentNodeId?: string;
    waitType?: string;
    stepCount: number;
    error?: string;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### 1.2 GET /api/projects/[id]/workflows/[workflowId]/executions/[executionId]
**Назначение**: Детальная информация о конкретном execution

**Ответ**:
```typescript
interface ExecutionDetails {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt?: Date;
  duration?: number;
  userId?: string;
  telegramChatId?: string;
  currentNodeId?: string;
  waitType?: string;
  stepCount: number;
  error?: string;
  steps: ExecutionStep[];
  variables: Record<string, any>;
  waitPayload?: any;
}

interface ExecutionStep {
  id: string;
  step: number;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  message?: string;
  data?: any;
  error?: string;
  variables?: Record<string, any>;
}
```

### 2. Real-time обновления

#### 2.1 Server-Sent Events endpoint
**GET /api/workflow/execution/[executionId]/stream**

**События**:
```typescript
// Начало выполнения ноды
interface NodeStartedEvent {
  type: 'node_started';
  data: {
    step: number;
    nodeId: string;
    nodeType: string;
    nodeLabel: string;
    timestamp: Date;
  };
}

// Завершение выполнения ноды
interface NodeCompletedEvent {
  type: 'node_completed';
  data: {
    step: number;
    nodeId: string;
    duration: number;
    result?: any;
    timestamp: Date;
  };
}

// Ошибка в ноде
interface NodeErrorEvent {
  type: 'node_error';
  data: {
    step: number;
    nodeId: string;
    error: string;
    timestamp: Date;
  };
}

// Изменение статуса execution
interface ExecutionStatusEvent {
  type: 'execution_status';
  data: {
    status: string;
    currentNodeId?: string;
    waitType?: string;
    timestamp: Date;
  };
}
```

### 3. Компоненты UI

#### 3.1 WorkflowExecutionViewer
```typescript
interface WorkflowExecutionViewerProps {
  executionId: string;
  workflowId: string;
  projectId: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  realTime?: boolean;      // Включить real-time обновления
  showTimeline?: boolean;   // Показать временную шкалу
  showVariables?: boolean;  // Показать переменные
}

const WorkflowExecutionViewer: React.FC<WorkflowExecutionViewerProps> = ({
  executionId,
  workflowId,
  projectId,
  nodes,
  connections,
  realTime = true,
  showTimeline = true,
  showVariables = false
}) => {
  // Логика компонента
};
```

**Функциональность**:
- Визуализация текущего состояния workflow
- Подсветка активной ноды
- Отображение пройденных нод
- Показ ошибок и предупреждений
- Интерактивные элементы для отладки

#### 3.2 ExecutionTimeline
```typescript
interface ExecutionTimelineProps {
  steps: ExecutionStep[];
  currentStep?: number;
  onStepClick?: (step: number) => void;
  showDuration?: boolean;
  showVariables?: boolean;
}

const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  steps,
  currentStep,
  onStepClick,
  showDuration = true,
  showVariables = false
}) => {
  // Логика компонента
};
```

**Функциональность**:
- Временная шкала выполнения
- Кликабельные шаги для детального просмотра
- Отображение длительности каждого шага
- Фильтрация по типу ноды или статусу

#### 3.3 ExecutionMonitoringDashboard
```typescript
interface ExecutionMonitoringDashboardProps {
  projectId: string;
  workflowId?: string;      // Опционально, для фильтрации по конкретному workflow
}

const ExecutionMonitoringDashboard: React.FC<ExecutionMonitoringDashboardProps> = ({
  projectId,
  workflowId
}) => {
  // Логика компонента
};
```

**Функциональность**:
- Таблица всех executions с сортировкой
- Фильтры по статусу, дате, пользователю
- Поиск по sessionId или telegramChatId
- Экспорт данных в CSV/JSON
- Массовые операции (остановка, удаление)

### 4. Аналитика производительности

#### 4.1 Метрики для сбора
```typescript
interface WorkflowMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  nodePerformance: {
    nodeId: string;
    nodeType: string;
    averageDuration: number;
    successRate: number;
    errorCount: number;
  }[];
  hourlyStats: {
    hour: string;
    executions: number;
    averageDuration: number;
  }[];
}
```

#### 4.2 API для аналитики
**GET /api/projects/[id]/workflows/[workflowId]/analytics**

**Параметры**:
```typescript
interface AnalyticsParams {
  period: 'hour' | 'day' | 'week' | 'month';
  dateFrom?: string;
  dateTo?: string;
  groupBy?: 'node' | 'user' | 'status';
}
```

### 5. Инструменты отладки

#### 5.1 Перезапуск execution
**POST /api/projects/[id]/workflows/[workflowId]/executions/[executionId]/restart**

**Параметры**:
```typescript
interface RestartExecutionParams {
  fromNodeId?: string;     // Перезапуск с определенной ноды
  resetVariables?: boolean; // Сброс переменных
  skipCompleted?: boolean;  // Пропустить уже выполненные ноды
}
```

#### 5.2 Просмотр переменных
**GET /api/projects/[id]/workflows/[workflowId]/executions/[executionId]/variables**

**Ответ**:
```typescript
interface ExecutionVariables {
  global: Record<string, any>;
  project: Record<string, any>;
  user: Record<string, any>;
  session: Record<string, any>;
  telegram: Record<string, any>;
}
```

#### 5.3 Экспорт логов
**GET /api/projects/[id]/workflows/[workflowId]/executions/[executionId]/export**

**Форматы**: JSON, CSV, TXT

### 6. Уведомления

#### 6.1 Критические ошибки
```typescript
interface CriticalErrorNotification {
  executionId: string;
  workflowId: string;
  nodeId: string;
  error: string;
  timestamp: Date;
  userId?: string;
  telegramChatId?: string;
}
```

#### 6.2 Настройки уведомлений
```typescript
interface NotificationSettings {
  enabled: boolean;
  email: boolean;
  webhook: boolean;
  webhookUrl?: string;
  errorThreshold: number;  // Количество ошибок для уведомления
  timeWindow: number;      // Временное окно в минутах
}
```

## 🏗️ Архитектура системы

### База данных
```sql
-- Расширение существующей таблицы workflow_logs
ALTER TABLE workflow_logs ADD COLUMN IF NOT EXISTS node_label VARCHAR(255);
ALTER TABLE workflow_logs ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE workflow_logs ADD COLUMN IF NOT EXISTS variables JSONB;

-- Новая таблица для метрик
CREATE TABLE workflow_metrics (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255) NOT NULL,
  node_id VARCHAR(255),
  metric_type VARCHAR(50) NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Индексы для производительности
CREATE INDEX idx_workflow_logs_execution_step ON workflow_logs(execution_id, step);
CREATE INDEX idx_workflow_logs_timestamp ON workflow_logs(timestamp);
CREATE INDEX idx_workflow_metrics_project_workflow ON workflow_metrics(project_id, workflow_id);
```

### Кэширование
```typescript
// Redis для real-time данных
interface ExecutionCache {
  executionId: string;
  status: string;
  currentNodeId: string;
  lastUpdate: Date;
  steps: ExecutionStep[];
}

// TTL: 1 час для активных executions, 24 часа для завершенных
```

## 🚀 План реализации

### Фаза 1: Базовый мониторинг (2-3 дня)
1. API endpoints для истории выполнения
2. Базовая страница мониторинга
3. Детальный просмотр execution

### Фаза 2: Real-time функциональность (2-3 дня)
1. Server-Sent Events
2. WorkflowExecutionViewer компонент
3. Real-time обновления в UI

### Фаза 3: Продвинутые функции (3-4 дня)
1. Аналитика производительности
2. Инструменты отладки
3. Уведомления

### Фаза 4: Оптимизация (1-2 дня)
1. Кэширование
2. Индексы базы данных
3. Производительность

## 📊 Ожидаемые результаты

1. **Улучшение отладки**: Время поиска проблем сократится с часов до минут
2. **Мониторинг производительности**: Выявление узких мест в workflow
3. **Пользовательский опыт**: Прозрачность выполнения для администраторов
4. **Масштабируемость**: Система готова к росту количества executions

## 🔧 Технические требования

- **Производительность**: Поддержка 1000+ concurrent executions
- **Масштабируемость**: Горизонтальное масштабирование через Redis
- **Надежность**: Graceful degradation при недоступности real-time функций
- **Безопасность**: Изоляция данных по проектам, аудит доступа
