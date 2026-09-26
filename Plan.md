# AirSim Mission Builder 飞行与生成策略

本文是首版实现的约束来源。编辑器和生成代码必须以 AirSim 1.8.1 的公开 Python API 为准，现有本地示例只用于理解需求，不作为 API 真值来源。

## 1. 目标和边界

首版为单架多旋翼无人机生成可读、可独立运行的 Python 任务脚本。测试人员在本地浏览器中拖放积木，保存 Blockly 工作区，并下载 Python 文件后自行在 Africa 仿真器旁运行。

首版不包含：

- 网页直接执行脚本或控制飞机；
- 多机同步或编队执行；
- 相机、激光雷达、天气和动态障碍感知；
- 低层姿态、PWM 或飞控 PID 参数；
- Python 反向还原积木；
- Africa 仿真器、Unreal 资源或 AirSim 源码。

## 2. 坐标、单位和 API 约束

AirSim 使用 NED 坐标系和 SI 单位：

- X 正方向为北/前；
- Y 正方向为东/右；
- Z 正方向向下；
- 10 米离地高度对应 `z = -10`；
- `YawMode` 的航向角为度，航向角速度为度/秒。

编辑器面向测试人员显示“高度”，并约定向上为正。生成器负责在唯一边界处转换为 `-abs(height)`，生成代码同时保留解释 NED 转换的注释。位置、速度、时间分别使用米、米每秒和秒。

AirSim 的飞行动作大多为异步 API。顺序任务必须对 Future 调用 `.join()`；不允许依靠下一条飞行命令隐式取消上一条命令。所有车辆相关调用都显式传入 `vehicle_name`，即使首版仅控制一架飞机。

## 3. 安全生命周期

每个生成脚本采用同一生命周期：

1. 创建 `airsim.MultirotorClient` 并确认连接；
2. 获取指定车辆的 API 控制权；
3. 解锁电机；
4. 执行积木生成的任务动作；
5. 无论正常结束、异常还是 Ctrl+C，都取消未完成动作；
6. 若仍在飞行则安全降落；
7. 锁桨并释放 API 控制；
8. 正常返回 0，Ctrl+C 返回 130，其他异常打印堆栈并返回 1。

编辑器只允许一个顶层“AirSim 任务”积木。连接、接管、解锁和最终清理由该积木统一生成，避免测试人员通过错误排序绕开安全流程。任务体内仍可显式放置“降落”积木；最终清理会读取飞行状态并避免重复降落。

## 4. 巡航与巡线策略

### 4.1 单点移动

精确前往一个 NED 位置时使用 `moveToPositionAsync(...).join()`。界面接受北向 X、东向 Y、正高度和速度，生成器转换高度并使用命名参数表达超时、驱动模式、航向和车辆名。

此方式适合：

- 到达指定检查点；
- 需要在每个点单独悬停或改变速度的任务；
- 调试和短航段。

### 4.2 连续路径

连续航点使用 `moveOnPathAsync`。首版固定：

- `drivetrain=airsim.DrivetrainType.MaxDegreeOfFreedom`；
- `yaw_mode=airsim.YawMode(is_rate=True, yaw_or_rate=0.0)`；
- `lookahead=-1`；
- `adaptive_lookahead=1`；
- 调用后 `.join()`。

AirSim 的路径接口负责跟踪给定折线，但不是避障规划器。路径有效性必须在调用前由积木输入或 A* 规划器确定。

### 4.3 圆形路径

首版选择参数化航点圆，而不是连续发送开环切向速度：

- 按 `x = cx + r*cos(theta)`、`y = cy + r*sin(theta)` 生成航点；
- 默认 72 段，允许配置 8–720 段；
- 顺时针和逆时针通过角度符号控制；
- 最后一个点显式回到起点，形成闭合路径；
- 生成的路径交给 `moveOnPathAsync`。

该策略可复用统一路径执行和可视化逻辑，避免开环速度积分导致半径持续漂移。它仍是离散近似，实际误差受路径前视距离、速度和 SimpleFlight 控制器影响。

## 5. 静态障碍 A* 规划

### 5.1 模型

A* 只在 XY 平面规划，高度沿航段弧长线性插值，属于 2.5D 规划。测试人员通过积木显式提供圆形障碍 `(x, y, radius)`；障碍按 `radius + clearance` 膨胀后参与碰撞检测。

这不是 Africa 场景几何识别，也不处理移动障碍或障碍高度。

### 5.2 搜索规则

- 八邻域网格；
- 直移代价为网格分辨率，斜移代价为 `sqrt(2)` 倍分辨率；
- 使用 octile distance 作为容许启发函数；
- 斜向移动时两个相邻正交格都必须可通行，禁止穿角；
- 起点和终点保留精确坐标；
- 起点或终点落在膨胀障碍内时直接失败；
- 预计网格超过 400,000 个单元时直接失败并要求提高分辨率；
- 搜索无解时直接失败，不回退为直线。

### 5.3 后处理

A* 原始路径先做线段—膨胀圆的视线检测，删除能安全跨越的中间网格点。对于多段用户航点，只有每段内部的 A* 网格点可以被删除，用户给出的航点必须保留。

高度在每段平滑后路径上按累计弧长从起始高度插值到目标高度。输出最终转换为 `airsim.Vector3r` 列表。

## 6. 积木到 Python 的契约

积木类别包括：

- 任务：唯一任务入口及 IP、端口、车辆名；
- 飞行：起飞、飞到坐标、改变高度、速度飞行、转向、悬停、等待、降落；
- 路径：航点、航点列表、圆形路径、圆形障碍、A* 规划、沿路径巡航；
- 可视化：绘制路径、清除永久标记；
- 状态：X、Y、高度和碰撞状态；
- 通用：Blockly 的变量、数学、列表、条件和循环。

生成代码遵循以下规则：

- 只依赖 Python 标准库和 `airsim==1.8.1`；
- 使用 `main()`、清晰变量名、命名参数和短注释；
- 字符串字段必须转义，不能作为原始 Python 拼接；
- 不提供任意 Python 代码积木；
- 圆形路径和 A* helper 只在对应积木出现时插入；
- 高度、速度、半径、分辨率和分段数既在编辑器验证，也在变量运行时再次验证；
- 有结构或输入错误时禁止下载 Python。

工作区文件格式：

```json
{
  "schemaVersion": 1,
  "name": "任务名",
  "workspace": {}
}
```

Blockly 工作区使用官方 JSON 序列化 API。保存文件命名为 `<任务名>.blocks.json`，生成脚本命名为 `<任务名>.py`。正式任务建议成对提交到 `missions/<任务名>/`。

## 7. 未来编队扩展

首版不实现多机。后续编队采用虚拟领机加固定偏移：

1. 从 `settings.json` 和 `listVehicles()` 获得车辆名；
2. 为每架飞机计算相对虚拟领机的 NED 偏移；
3. 同一步先向所有飞机下发 Future，再统一 `.join()`；
4. 不允许对第一架等待完成后才向第二架发送指令；
5. 配置最小间距、起飞次序和故障时全队悬停/降落策略。

首版所有生成调用仍显式传 `vehicle_name`，减少未来扩展时的接口迁移。

## 8. 验收标准

- 生成代码能通过 Python 3.10 语法编译；
- 高度统一转换为负 Z，航向保持度制；
- 所有顺序 Async 动作都有 `.join()`；
- 正常、异常和 Ctrl+C 都会清理飞行状态；
- 圆形路径闭合且航点半径误差在浮点容差内；
- A* 能绕过圆形障碍并满足膨胀安全距离；
- A* 无路、非法端点或超大网格时拒绝飞行；
- 工作区 JSON 保存后重新载入能生成同等 Python；
- Release 便携包解压后可通过 `start-editor.bat` 打开编辑器并下载脚本。

## 9. 参考资料

- [AirSim APIs](https://microsoft.github.io/AirSim/apis/)
- [AirSim Python API 1.8.1](https://microsoft.github.io/AirSim/api_docs/html/)
- [AirSim Python client source](https://github.com/microsoft/AirSim/blob/main/PythonClient/airsim/client.py)
- [AirSim multiple vehicles](https://microsoft.github.io/AirSim/multi_vehicle/)
- [Blockly block code generators](https://developers.google.com/blockly/guides/create-custom-blocks/code-generation/block-code)
- [Blockly JSON serialization](https://developers.google.com/blockly/guides/configure/web/serialization)
