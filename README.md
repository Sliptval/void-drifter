<div align="center">

# 🌌 Void Drifter

### Космический survival bullet hell прямо в браузере

[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![No Build](https://img.shields.io/badge/build-none-success)](#запуск-локально)
[![Yandex Games](https://img.shields.io/badge/Yandex-Games-FF0000?logo=yandex&logoColor=white)](https://yandex.ru/games/)

**[▶ Играть онлайн](http://31.76.251.193/)**

</div>

---

Делаю свою игру в жанре space bullet hell по волнам (вайб Brotato), на чистом JS и Canvas —
без фреймворков, без сборки. Вся графика рисуется кодом, звук — через Web Audio API.

## Геймплей

- Корабль на арене, авто-стрельба по ближайшему врагу. Весь фокус на уворотах — хитбокс
  игрока маленькая точка в центре корабля.
- Игра идёт волнами: пережил волну → выбираешь 1 из 3 улучшений (стакаются) → следующая волна.
- Каждая 5-я волна — босс с фазами и HP-баром.
- Сложность растёт по ходу игры, очки и рекорд сохраняются в localStorage.

## Управление

| Действие | Клавиши |
|---|---|
| Движение | `W A S D` / стрелки |
| Дэш | `Space` |
| Пауза | `Esc` / `P` |
| Мьют звука | `M` |
| Выбор апгрейда | клик или `1` / `2` / `3` |
| Реролл апгрейдов | `R` |
| FPS/отладка | `F3` |
| Старт / рестарт | клик или `Enter` |

## Запуск локально

ES-модули не работают через `file://`, нужен любой статик-сервер:

```bash
python3 -m http.server 8080
# открыть http://localhost:8080
```

## Баланс

Все цифры (урон, HP, спавн, скорости, боссы, апгрейды) в одном файле — [`js/config.js`](js/config.js).

## Производительность

Object pooling, аддитивное свечение через `globalCompositeOperation`, коллизии по
spatial grid — держит сотни-тысячи пуль и частиц на 60 FPS.
