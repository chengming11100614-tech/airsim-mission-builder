# AirSim Mission Builder

AirSim Mission Builder 是一个面向测试人员的本地积木式任务编辑器。它将可视化飞行动作转换为可读、可独立执行的 Python 脚本，目标环境为 Python 3.10/3.11 与 AirSim 1.8.1。

项目正在按 [Plan.md](Plan.md) 实施。仓库不包含 AirSim、Unreal 场景、Africa 仿真器或虚拟环境。

## 项目边界

- 首版只支持单架多旋翼无人机。
- 编辑器只生成脚本，不直接控制仿真器。
- 高度在界面中向上为正，生成代码会转换为 AirSim NED 坐标的负 Z。
- 正常结束和异常中断都会执行安全降落、锁桨并释放 API 控制。

## 许可证

[MIT](LICENSE)
