<div align="center">

# 🌌 Void Drifter

### Космический survival bullet hell прямо в браузере

[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![No Build](https://img.shields.io/badge/build-none-success)](#запуск-локально)
[![Yandex Games](https://img.shields.io/badge/Yandex-Games-FF0000?logo=yandex&logoColor=white)](https://yandex.ru/games/)
[![License](https://img.shields.io/badge/license-MIT-blue)](#)

**[▶ Играть онлайн](http://31.76.251.193/)**

</div>

---

Браузерная игра в жанре **space bullet hell по волнам** (вайб Brotato) на чистом vanilla JS +
HTML5 Canvas. Без фреймворков, без сборки, без ассет-файлов — вся графика рисуется кодом, весь
звук синтезируется через Web Audio API. Это статический сайт: `index.html`, `style.css`, `js/`.
Полностью на русском, готова к публикации в **Яндекс Играх** (интеграция SDK + ZIP).

## Геймплей

- Маленький корабль на арене, **авто-стрельба** по ближайшему врагу. Весь фокус — на **уворотах**.
  Хитбокс игрока — крошечная яркая точка в центре корабля.
- Игра идёт **волнами**: пережить волну (обратный отсчёт на экране) → **выбор 1 из 3 улучшений**
  (стакаются и комбинируются) → следующая волна. Между волнами небольшой хил.
- **Каждая 5-я волна — босс**: фазы, HP-бар, комбинированные паттерны; волна кончается с его смертью.
- Сложность растёт **с номером волны** (плавно), число врагов на экране ограничено для читаемости.
- Очки, комбо-множитель, рекорд в `localStorage`.
- **Крючки удержания (Yandex SDK):** rewarded-реклама на **воскрешение** после смерти и на
  **+1 улучшение** между волнами. Вне Яндекса эти кнопки не показываются (безопасный фолбэк).

## Управление

| Действие | Клавиши |
|---|---|
| Движение | `W A S D` / стрелки |
| Дэш (рывок с i-frames) | `Space` |
| Пауза | `Esc` / `P` |
| Мьют звука | `M` |
| Выбор апгрейда | клик мышью или `1` / `2` / `3` |
| Реролл апгрейдов | `R` |
| FPS/отладка | `F3` |
| Старт / рестарт | клик или `Enter` |

## Запуск локально

ES-модули требуют HTTP (не открывать через `file://`). Любой статик-сервер подойдёт:

```bash
cd /opt/SpaceBulletHell
python3 -m http.server 8080
# затем открой http://localhost:8080
```

Остановить сервер — `Ctrl+C` в его терминале (или убить процесс `http.server`).

## Деплой (nginx)

Это статика — положить `index.html`, `style.css` и папку `js/` в web-root.

```nginx
server {
    listen 80;
    server_name void-drifter.example.com;
    root /var/www/void-drifter;          # сюда кладём файлы игры
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # .js обычно уже отдаётся как text/javascript; при необходимости:
    types { application/javascript js; }
}
```

Проверка отдачи:

```bash
curl -sI http://localhost:8080/js/main.js | grep -i content-type   # text/javascript
```

## Текущий деплой (актуально)

Игра выложена в интернет на этом хосте через **nginx** и доступна из любой точки мира:

- **URL:** `http://31.76.251.193/` (пока без домена, по публичному IP, HTTP)
- Конфиг сайта: `/etc/nginx/sites-available/voiddrifter.conf` → симлинк в `sites-enabled/`,
  стоковый `default` отключён. `root /opt/SpaceBulletHell`, порт 80, `default_server`.
- nginx включён в автозапуск (`systemctl enable nginx`) — переживает перезагрузку.
- Управление: `systemctl restart|status nginx`; логи `/var/log/nginx/voiddrifter.*.log`.

### Когда появится домен

1. Навести A-запись домена на `31.76.251.193`.
2. В конфиге заменить `server_name _;` на `server_name твой-домен;`.
3. Выпустить TLS-сертификат: `certbot --nginx -d твой-домен` (Let's Encrypt) → HTTPS.

> Примечание: сейчас отдаётся по голому IP и без TLS — это нормально на этапе «без домена».
> Если IP машины не статический (VM может пересоздаться), после смены IP обнови A-запись.

## Публикация в Яндекс Играх

Игра интегрирована с **Yandex Games SDK** и упаковывается в ZIP для загрузки в консоль.

1. **Собрать архив** (в корне проекта появится `voiddrifter-yandex.zip` с `index.html` в корне):
   ```bash
   cd /opt/SpaceBulletHell
   python3 - <<'PY'
   import zipfile, os
   files=['index.html','style.css']+['js/'+f for f in sorted(os.listdir('js')) if f.endswith('.js')]
   with zipfile.ZipFile('voiddrifter-yandex.zip','w',zipfile.ZIP_DEFLATED) as z:
       for r in files: z.write(r, r)
   print('ok', files)
   PY
   ```
   (или `zip -r voiddrifter-yandex.zip index.html style.css js/`, если `zip` установлен).
2. В **консоли разработчика** `games.yandex.ru/console/` создать игру, загрузить ZIP, заполнить
   метаданные (название, описание, иконка 512×512, обложки), открыть **черновик** и проверить.
3. Отправить на модерацию → публикация.

Технические детали интеграции:
- `index.html` подключает `<script src="/sdk.js">` (живёт только на хосте Яндекса; 404 локально/на
  nginx безвреден).
- `js/yandex.js` — обёртка с **безопасным фолбэком**: без `window.YaGames` все вызовы no-op, игра
  работает и на nginx `31.76.251.193`, и из `python3 -m http.server`.
- На старте вызывается `LoadingAPI.ready()` — убирает прелоадер Яндекса.
- Rewarded-реклама: воскрешение (`game.js → requestRevive`) и доп. улучшение
  (`requestAdBonus`). Звук мьютится на время ролика и при сворачивании вкладки.
- Баланс рекламы — `CFG.ads` в [`js/config.js`](js/config.js) (`maxRevives`, `reviveHeal`).

## Тюнинг баланса

Все числа (урон, HP, волны, спавн, скорости, тайминги боссов, сила апгрейдов, реклама, цвета,
флаги фич) — в одном файле: [`js/config.js`](js/config.js). Блок `CFG.wave` — длина и сложность
волн, `bossEvery: 5`, разблокировки типов врагов по номеру волны. Логику править не нужно.

## Производительность

Заточено под сотни-тысячи пуль/частиц при 60 FPS: object pooling, аддитивное свечение
(`globalCompositeOperation = 'lighter'` + пре-рендер glow-спрайтов, без `shadowBlur`),
коллизии по расстоянию² через spatial grid, swap-remove мёртвых сущностей, без аллокаций в кадре.

Структуру модулей и договорённости — см. комментарии в исходниках `js/`.
