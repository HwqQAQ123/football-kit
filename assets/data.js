/* football-money-kit · 共享示例数据层
   所有数据均为演示用虚构赛事，不构成任何购彩建议。 */
window.FB = (function () {
  // 球场坐标：x=0~100(沿长度,主队向右进攻)，y=0~100(沿宽度)
  var PITCH = { w: 105, h: 68 };

  var MATCH = {
    home: { name: "蓝鲸", short: "BW", color: "#185FA5", score: 2, xg: 2.34 },
    away: { name: "红狼", short: "RW", color: "#A32D2D", score: 1, xg: 1.07 },
    competition: "演示超级联赛 · 第 24 轮",
    date: "2026-08-22",
    stats: {
      labels: ["控球率", "射门", "射正", "传球", "传球成功率", "角球", "犯规"],
      home: [58, 14, 6, 612, 86, 7, 11],
      away: [42, 8, 3, 438, 79, 4, 14],
      unit: ["%", "", "", "", "%", "", ""]
    },
    xgTimeline: [
      { m: 0, h: 0.00, a: 0.00 }, { m: 10, h: 0.21, a: 0.05 },
      { m: 20, h: 0.38, a: 0.12 }, { m: 30, h: 0.52, a: 0.34 },
      { m: 40, h: 0.70, a: 0.41 }, { m: 45, h: 0.83, a: 0.47 },
      { m: 55, h: 1.10, a: 0.60 }, { m: 65, h: 1.42, a: 0.72 },
      { m: 75, h: 1.78, a: 0.85 }, { m: 85, h: 2.12, a: 0.97 },
      { m: 90, h: 2.34, a: 1.07 }
    ],
    // 射门：x,y 为 0~100 球场坐标；result: goal/miss/saved/post
    shots: {
      home: [
        { x: 88, y: 46, xg: 0.42, r: "goal", m: 23 },
        { x: 92, y: 55, xg: 0.55, r: "goal", m: 67 },
        { x: 80, y: 30, xg: 0.18, r: "miss", m: 12 },
        { x: 85, y: 60, xg: 0.22, r: "saved", m: 39 },
        { x: 90, y: 48, xg: 0.30, r: "post", m: 52 },
        { x: 78, y: 40, xg: 0.12, r: "miss", m: 61 },
        { x: 93, y: 50, xg: 0.40, r: "saved", m: 74 },
        { x: 84, y: 35, xg: 0.15, r: "miss", m: 81 }
      ],
      away: [
        { x: 14, y: 52, xg: 0.28, r: "goal", m: 31 },
        { x: 18, y: 44, xg: 0.16, r: "saved", m: 9 },
        { x: 12, y: 58, xg: 0.20, r: "miss", m: 45 },
        { x: 20, y: 49, xg: 0.14, r: "miss", m: 58 },
        { x: 16, y: 40, xg: 0.18, r: "saved", m: 70 },
        { x: 22, y: 55, xg: 0.11, r: "miss", m: 84 }
      ]
    }
  };

  // 4-3-3 阵型节点（主场坐标，客场镜像）
  function formation(prefix) {
    return [
      { id: prefix + "GK", n: "GK", x: 6, y: 50 },
      { id: prefix + "LB", n: "LB", x: 24, y: 16 },
      { id: prefix + "CB1", n: "CB", x: 22, y: 38 },
      { id: prefix + "CB2", n: "CB", x: 22, y: 62 },
      { id: prefix + "RB", n: "RB", x: 24, y: 84 },
      { id: prefix + "CM1", n: "CM", x: 44, y: 28 },
      { id: prefix + "CM2", n: "DM", x: 42, y: 50 },
      { id: prefix + "CM3", n: "CM", x: 44, y: 72 },
      { id: prefix + "LW", n: "LW", x: 70, y: 18 },
      { id: prefix + "ST", n: "ST", x: 74, y: 50 },
      { id: prefix + "RW", n: "RW", x: 70, y: 82 }
    ];
  }

  // 确定性随机数，保证每次刷新图形一致
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 生成传球网络（边=传球量），基于距离+位置角色
  function buildPassNetwork(team, seed) {
    var nodes = formation(team === "home" ? "h" : "a");
    if (team === "away") nodes.forEach(function (p) { p.x = 100 - p.x; });
    var rnd = mulberry32(seed), edges = [];
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        var prob = d < 30 ? 0.9 : d < 50 ? 0.5 : 0.18;
        // 门将只连后卫，前锋少回传
        if ((a.n === "GK" || b.n === "GK") && d > 26) prob = 0.02;
        if (rnd() < prob) {
          var val = Math.round((70 - d) * (0.6 + rnd() * 0.9));
          if (val > 4) edges.push({ s: a.id, t: b.id, v: val });
        }
      }
    }
    edges.sort(function (x, y) { return y.v - x.v; });
    return { nodes: nodes, edges: edges.slice(0, 18) };
  }

  // 生成热区网格 12 x 7
  function buildHeatmap(team, seed) {
    var rnd = mulberry32(seed), gx = 12, gy = 7, grid = [];
    var dir = team === "home" ? 1 : -1;       // 进攻方向
    var hotX = team === "home" ? 78 : 22;     // 对方禁区附近
    for (var i = 0; i < gx; i++) {
      grid[i] = [];
      for (var j = 0; j < gy; j++) {
        var cx = (i + 0.5) / gx * 100, cy = (j + 0.5) / gy * 100;
        var base = 8 + 30 * Math.exp(-Math.pow((cx - hotX) / 28, 2));
        base += 18 * Math.exp(-Math.pow((cy - 50) / 22, 2));   // 中路更热
        base += 10 * Math.exp(-Math.pow((cx - 50) / 18, 2));   // 中场
        base += (rnd() - 0.5) * 8;
        grid[i][j] = Math.max(2, Math.round(base));
      }
    }
    return grid;
  }

  // ---------- 竞彩复盘模板数据 ----------
  var REVIEW = {
    match: "蓝鲸 vs 红狼",
    league: "演示超级联赛 第24轮",
    // 数据结构（给开发者/模板使用者看的 schema 说明）
    schema: {
      match_id: "string",
      kickoff: "ISO8601",
      teams: { home: "string", away: "string" },
      odds: { win: "number", draw: "number", lose: "number", asian_handicap: "string" },
      form: { home: ["W","D","L"], away: ["W","D","L"] },
      h2h: [{ date: "ISO8601", score: "string", asian_result: "win|draw|lose" }],
      model: { home_prob: "number", draw_prob: "number", away_prob: "number" }
    },
    homeForm: ["W", "W", "D", "L", "W", "D", "W", "W", "L", "W"],
    awayForm: ["L", "D", "W", "L", "D", "L", "W", "D", "L", "D"],
    h2h: [
      { date: "25-11", score: "2-1", ar: "win" },
      { date: "25-04", score: "1-1", ar: "draw" },
      { date: "24-12", score: "0-2", ar: "lose" },
      { date: "24-05", score: "3-0", ar: "win" },
      { date: "23-11", score: "1-2", ar: "lose" }
    ],
    // 近 10 场让球盘路（含本场模拟）
    asianLine: "主让0.75球",
    asianHistory: [1, 0, 1, 0, 1, 1, 0, 1, 1, 0], // 1=赢盘 0=未赢盘
    model: { home: 0.52, draw: 0.25, away: 0.23 },
    valueNote: "模型主胜概率 52% 对应公平赔率约 1.92，若实盘主胜 ≤ 1.80 视为存在价值空间。"
  };

  // ---------- 小程序比赛列表 ----------
  var MATCHES = [
    { id: "m1", league: "演示超", home: "蓝鲸", away: "红狼", time: "08-22 19:30", status: "完场", score: "2-1", hot: true },
    { id: "m2", league: "演示超", home: "黑豹", away: "金鹰", time: "08-22 21:00", status: "进行中", score: "1-0", hot: true },
    { id: "m3", league: "演示甲", home: "白鹿", away: "青松", time: "08-23 18:00", status: "未开赛", score: "VS", hot: false },
    { id: "m4", league: "演示甲", home: "银狐", away: "赤焰", time: "08-23 20:30", status: "未开赛", score: "VS", hot: false },
    { id: "m5", league: "演示杯", home: "蓝鲸", away: "银狐", time: "08-25 22:00", status: "未开赛", score: "VS", hot: true },
    { id: "m6", league: "演示超", home: "金鹰", away: "白鹿", time: "08-26 19:30", status: "未开赛", score: "VS", hot: false }
  ];

  // ---------- 球员数据（小程序·球员榜/热图） ----------
  var TEAM_COLORS = {
    "蓝鲸": "#185FA5", "红狼": "#A32D2D", "黑豹": "#3B6D11", "金鹰": "#BA7517",
    "白鹿": "#534AB7", "银狐": "#0C447C", "赤焰": "#C0392B", "青松": "#2E7D32"
  };
  var PLAYERS = [
    { id: "p1",  name: "林涛", team: "蓝鲸", pos: "FW", goals: 12, assists: 5, xg: 11.2, shots: 48, passAcc: 84, zone: [74, 46], seed: 11 },
    { id: "p2",  name: "周野", team: "蓝鲸", pos: "MF", goals: 6,  assists: 9, xg: 6.8,  shots: 30, passAcc: 88, zone: [60, 38], seed: 12 },
    { id: "p3",  name: "陈昊", team: "蓝鲸", pos: "MF", goals: 4,  assists: 7, xg: 5.1,  shots: 22, passAcc: 90, zone: [55, 62], seed: 13 },
    { id: "p4",  name: "赵磊", team: "蓝鲸", pos: "DF", goals: 2,  assists: 1, xg: 1.2,  shots: 6,  passAcc: 91, zone: [22, 50], seed: 14 },
    { id: "p5",  name: "马俊", team: "红狼", pos: "FW", goals: 9,  assists: 4, xg: 8.4,  shots: 40, passAcc: 80, zone: [26, 54], seed: 21 },
    { id: "p6",  name: "孙浩", team: "红狼", pos: "MF", goals: 5,  assists: 6, xg: 5.5,  shots: 25, passAcc: 86, zone: [40, 30], seed: 22 },
    { id: "p7",  name: "黄强", team: "红狼", pos: "MF", goals: 3,  assists: 8, xg: 4.2,  shots: 20, passAcc: 87, zone: [42, 70], seed: 23 },
    { id: "p8",  name: "吴鹏", team: "红狼", pos: "DF", goals: 1,  assists: 2, xg: 0.9,  shots: 5,  passAcc: 89, zone: [22, 50], seed: 24 },
    { id: "p9",  name: "李响", team: "黑豹", pos: "FW", goals: 10, assists: 3, xg: 9.0,  shots: 38, passAcc: 82, zone: [74, 46], seed: 31 },
    { id: "p10", name: "郑凯", team: "金鹰", pos: "MF", goals: 7,  assists: 8, xg: 6.9,  shots: 28, passAcc: 88, zone: [58, 52], seed: 32 },
    { id: "p11", name: "王超", team: "白鹿", pos: "FW", goals: 8,  assists: 5, xg: 7.6,  shots: 35, passAcc: 81, zone: [74, 46], seed: 33 },
    { id: "p12", name: "刘洋", team: "银狐", pos: "MF", goals: 6,  assists: 7, xg: 6.1,  shots: 26, passAcc: 87, zone: [56, 56], seed: 34 },
    { id: "p13", name: "张伟", team: "赤焰", pos: "FW", goals: 7,  assists: 4, xg: 6.8,  shots: 33, passAcc: 80, zone: [26, 46], seed: 35 },
    { id: "p14", name: "杨光", team: "青松", pos: "DF", goals: 1,  assists: 3, xg: 1.0,  shots: 4,  passAcc: 90, zone: [22, 50], seed: 36 }
  ];
  // 球员活动热区：以偏好区域为中心的高斯分布
  function buildPlayerHeatmap(p) {
    var gx = 12, gy = 7, grid = [], rnd = mulberry32(p.seed || 1);
    for (var i = 0; i < gx; i++) {
      grid[i] = [];
      for (var j = 0; j < gy; j++) {
        var cx = (i + 0.5) / gx * 100, cy = (j + 0.5) / gy * 100;
        var v = 62 * Math.exp(-(Math.pow(cx - p.zone[0], 2) + Math.pow(cy - p.zone[1], 2)) / (2 * 240));
        v += 6 * Math.exp(-Math.pow((cx - 50) / 22, 2)); // 中场微 Bias
        v += (rnd() - 0.5) * 6;
        grid[i][j] = Math.max(1, Math.round(v));
      }
    }
    return grid;
  }

  return {
    PITCH: PITCH, MATCH: MATCH, REVIEW: REVIEW, MATCHES: MATCHES,
    PLAYERS: PLAYERS, TEAM_COLORS: TEAM_COLORS,
    buildPassNetwork: buildPassNetwork, buildHeatmap: buildHeatmap, buildPlayerHeatmap: buildPlayerHeatmap
  };
})();
