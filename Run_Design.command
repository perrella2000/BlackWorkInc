#!/bin/zsh
# Финальный скрипт запуска BlackWorkInc
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

echo "=================================================="
echo "👷 Чистый запуск дизайна BlackWorkInc"
echo "=================================================="

# Очищаем старые процессы, чтобы не было конфликтов портов
echo "🧹 Очистка старых серверов..."
lsof -ti:1574,5173 | xargs kill -9 2>/dev/null

cd "/Users/n3/Desktop/BlackWorkInc/webapp" || { echo "❌ Ошибка!"; exit 1; }

echo "🚀 Запуск сервера на порту 1574..."
(sleep 2 && open "http://localhost:1574") &

# Запуск Vite с принудительным портом
npm run dev -- --port 1574 --host
