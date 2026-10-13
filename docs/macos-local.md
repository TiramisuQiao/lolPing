# macOS fork：构建与本地安装

此 fork 基于 darrenprx/lolPing 已有的 macOS 实现，保留原有功能与 MIT 署名。发布和应用内更新指向 `TiramisuQiao/lolPing`；独立的 bundle ID 为 `com.tiramisuqiao.lolping`。首次发布前，GitHub 返回的“暂无 release”会显示为暂无更新。

Electron 44.5.1 的实际最低系统版本为 macOS 13，本 fork 已同步修正文档和安装包声明。

## 源码安装（Apple Silicon）

需要 macOS 13+ 的 Apple Silicon Mac、原生 arm64 Node.js 22.12+ 和 Xcode Command Line Tools。

```bash
npm ci
npm run install:mac
```

这会编译 C++ 输入辅助程序和 Electron 应用、生成 `release/lolPing-<version>-arm64.dmg`，再校验签名与架构，将应用安装到 `~/Applications/lolPing.app` 并打开。无需 sudo。如果已有 lolPing 正在运行，先从菜单栏退出。旧安装会保留为同目录下带时间戳的 `.backup-*` 文件；用户设置不会被删除。

只构建安装包：`npm run dist:mac`。安装已经构建好的应用：`node tools/mac/install.mjs`。也可以打开 DMG，将应用拖入 Applications。

## 首次打开

在应用的权限提示中点击“打开系统设置”，在 **系统设置 → 隐私与安全性 → 辅助功能** 中开启刚安装的 lolPing。此项需要用户亲自确认；应用会等待权限并自动启动输入辅助程序。

- 按住 **⌥ Option**，鼠标拖动，松开：发送信号。
- 按住 **⌃ Control** 拖动：表情轮盘。
- **⌃⌥P**：暂停或恢复。
- 菜单栏信号图标：设置或退出。

本地构建使用临时签名，没有 Apple 开发者公证。更换构建后可能需要在辅助功能列表中移除旧条目，再添加 `~/Applications/lolPing.app`。下载的 DMG 若被系统拦截，在隐私与安全性中选择“仍要打开”。

## 验证

```bash
npm run typecheck
npm run test:helper
npm test
npm run dist:mac
codesign --verify --deep --strict release/mac-arm64/lolPing.app
```

真实桌面测试应确认：设置页能打开、点击信号能预览动画和声音、授权后 Option 拖动能打开轮盘、鼠标能正常移动、取消手势正常、菜单栏退出后辅助程序结束。未授予辅助功能权限时只能验证渲染和模拟输入，不能据此认定全局手势已经通过测试。

配置仍保存在 `~/Library/Application Support/lolPing`，与上游版本兼容。不要同时运行两份 lolPing。

## 发布

更新 `package.json` 与 `package-lock.json` 的版本，推送匹配的 `v<version>` 标签即可触发原有发布工作流；发布目标已改为此 fork。自动化工作流保留 Windows 构建以支持跨平台房间，Mac 的主产物为 arm64 DMG。不要将 `node_modules`、`out`、`release` 或个人设置提交到 Git。

## 本次本地验证（2026-10-13）

环境：Apple Silicon，macOS 27.0，Node.js 22.21.0，Electron 44.5.1。

- TypeScript 类型检查通过。
- C++ 原生辅助程序：411 项通过，0 项失败。
- TypeScript：44 个测试文件通过，713 项通过；1 项 Windows 专用文件重命名测试在 Mac 上跳过。
- 安装到 `~/Applications/lolPing.app` 后，应用签名与主程序、输入辅助程序的 ARM64 架构校验通过。
- 对安装后的应用运行界面测试：Mac 设置页加载、信号与表情预览及贴图加载通过；Web Audio 上下文处于 running 状态；没有渲染器异常或缺失资源；真实 GitHub 更新检查返回暂无更新。
- 首次界面测试时辅助功能状态为 `noAccess`；用户授权后，原生输入辅助程序已成功启动并持续运行。尚未完成全局 Option 拖动的端到端测试，也未通过人工听音确认扬声器输出。双显示器、全屏应用和跨设备房间不在本次实机验证范围内。

本地截图和界面测试结果保存在 `release/local-verification/`（不提交个人运行产物）。


## 持续后台运行与退出排查

安装后运行：

```bash
npm run background:mac
npm run background:mac -- status
```

这会添加用户级 LaunchAgent `com.tiramisuqiao.lolping.background`：登录时启动、脱离终端或开发会话运行，异常退出后自动重启（启动间隔至少 15 秒）。重复执行启用命令不会重启正在运行的应用。从菜单栏正常选择“退出”仍会停止应用；需要重新启动时再次运行启用命令。关闭设置窗口不影响后台运行。启用服务后，后续通过安装脚本更新也会继续由该服务启动。

后台服务已负责登录启动，无需再开启应用内的“登录时打开”，以免重复启动。日志位于 `~/Library/Logs/lolPing/background.log` 和 `background-error.log`。停用服务：

```bash
npm run background:mac -- disable
```

本次排查未发现 lolPing 的 macOS 崩溃报告；系统日志记录的一次 voluntary 退出与测试中的主动重启吻合。早期调试实例由开发执行会话直接启动，也会受到会话中断影响。正常启动的应用与已获授权的输入辅助程序连续运行超过 7 分钟；后台管理现改用独立的 LaunchAgent，后续退出可结合该服务状态和日志排查。

后台服务实测：普通 SIGTERM 被应用作为正常退出处理，服务保持停止；再次启用可恢复。用 SIGKILL 模拟异常退出后，LaunchAgent 自动拉起新进程，已授权的输入辅助程序同步恢复，连续观察 90 秒无再次退出。重复启用服务不会打断已运行的进程。验证记录保存在本地 `release/local-verification/background.json`。
