# Sandbox Platform

Roblox 式沙盒：Three.js + React 客户端、Lua 运行时、Express 服务器、Studio 编辑器。

## 用途与 Target 判定

| 平台 | 需要? | 方式 |
|------|-------|------|
| 移动端 | 可选 | Web 平台为主；手机壳非本阶段强制 |
| 智能硬件 | 不适用 | 创作/游玩平台，非体感产品 |

## 命令

```bash
npm test
npm run build
```

以根 `package.json` 实际脚本为准；缺 test 时先补 Sensor。

## Harness / Loop（助手）

- Guide = 本文件；Sensor = 根脚本中的 test/build
- 同类失误第二次 → 规则或测试（棘轮）

## 验证环 / Done

```bash
npm test
npm run build
```

**Done**：workspace 可构建。不要为「形式上的 Harness 完整」硬加 APK。
