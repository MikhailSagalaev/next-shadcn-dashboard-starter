# 🚀 План деплоя SaaS Bonus System на VPS/REG.RU

## 📋 ОБЗОР АРХИТЕКТУРЫ

```
Internet → Cloudflare/REG.RU DNS → VPS Server
                                     ├── Nginx (Reverse Proxy, SSL)
                                     ├── Docker Compose
                                     │   ├── Next.js App (Port 3000)
                                     │   ├── PostgreSQL (Port 5432)
                                     │   └── Redis (Port 6379) [опционально]
                                     ├── Certbot (SSL сертификаты)
                                     └── Docker Registry (для CI/CD)
```

## 🎯 ЭТАП 1: Подготовка VPS (30 минут)

### Требования к серверу:
- **CPU**: 2+ ядра
- **RAM**: 4GB+ (рекомендуется 8GB)
- **SSD**: 40GB+ (рекомендуется 80GB)
- **OS**: Ubuntu 22.04 LTS или CentOS 8
- **Bandwidth**: Безлимитный

### REG.RU рекомендации:
- **VPS-1**: 2 CPU, 4GB RAM, 40GB SSD (~1500₽/мес)
- **VPS-2**: 4 CPU, 8GB RAM, 80GB SSD (~3000₽/мес) ⭐ РЕКОМЕНДУЕТСЯ

## 🎯 ЭТАП 2: Базовая настройка сервера (45 минут)

### 2.1 Безопасность и пользователи
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Создание пользователя для деплоя
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo usermod -aG docker deploy

# Настройка SSH ключей
ssh-copy-id deploy@your-vps-ip
```

### 2.2 Установка базового ПО
```bash
# Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install docker-compose-plugin -y

# Nginx
sudo apt install nginx -y

# Certbot для SSL
sudo apt install certbot python3-certbot-nginx -y

# Git, Curl, Htop
sudo apt install git curl htop unzip -y
```

## 🎯 ЭТАП 3: Настройка домена и DNS (15 минут)

### 3.1 В панели REG.RU или Cloudflare:
```
A запись: your-domain.ru → VPS-IP
CNAME: www.your-domain.ru → your-domain.ru
CNAME: api.your-domain.ru → your-domain.ru (для API)
```

### 3.2 Проверка DNS:
```bash
dig your-domain.ru
nslookup your-domain.ru
```

## 🎯 ЭТАП 4: Конфигурация проекта (20 минут)

### 4.1 Клонирование и настройка
```bash
cd /home/deploy
git clone https://github.com/your-username/next-shadcn-dashboard-starter.git
cd next-shadcn-dashboard-starter
```

### 4.2 Production environment файл
```bash
cp env.example.txt .env.production
```

## 🎯 ЭТАП 5: Docker Production конфигурация (30 минут)

### 5.1 Улучшенный docker-compose.production.yml
### 5.2 Nginx конфигурация
### 5.3 SSL сертификаты

## 🎯 ЭТАП 6: CI/CD и автоматизация (45 минут)

### 6.1 GitHub Actions деплой
### 6.2 Скрипты обновления
### 6.3 Бэкапы базы данных

## 🎯 ЭТАП 7: Мониторинг и логирование (30 минут)

### 7.1 Логи Docker контейнеров
### 7.2 Мониторинг ресурсов
### 7.3 Алерты и уведомления

## 📊 ИТОГОВАЯ СТОИМОСТЬ:

### Ежемесячные расходы:
- **VPS REG.RU**: 1500-3000₽
- **Домен .ru**: 300₽/год
- **SSL сертификат**: Бесплатно (Let's Encrypt)
- **Cloudflare**: Бесплатно
- **ИТОГО**: ~2000-3500₽/мес

### Разовые расходы:
- **Настройка**: 0₽ (делаем сами по инструкции)
- **Домен**: 300₽
- **ИТОГО**: 300₽

## ⏱️ ВРЕМЕННЫЕ ЗАТРАТЫ:
- **Полная настройка**: 3-4 часа
- **Базовый деплой**: 1-2 часа
- **Автоматизация**: +2 часа

## 🎯 РЕЗУЛЬТАТ:
✅ Production-ready SaaS система
✅ HTTPS с автообновлением SSL
✅ Автоматические деплои через Git
✅ Мониторинг и логирование
✅ Автоматические бэкапы
✅ 99.9% uptime
