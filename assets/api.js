/* football-money-kit · 可插拔数据接口层
   设计目标：用统一接口 FB.api.listMatches() / getMatch() 取数，
   默认走本地示例数据（离线可用），配置后即可切换为真实足球 API。

   已内置三个真实数据源适配器：
   - openligadb     ：OpenLigaDB 德甲（免费·无 Key·含赛程/比分，不含 xG/射门坐标）
   - football_data  ：football-data.org（需 Key·含赛程/比分，不含 xG/射门坐标）
   - api_football   ：API-Football (api-sports.io)（需 Key·高级源，含 xG/统计/射门事件/球员）
   新增数据源只需在 providers 里加一项并写好响应映射函数（参考 mapApiFootball*）。 */
window.FB = window.FB || {};
FB.api = (function () {
  var KEY = "fb_api_cfg_v1";
  // API-Football 默认抓取的联赛/赛季（英超 2023-24），可改
  var AF_LEAGUE = 39, AF_SEASON = 2023;
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { provider: "openligadb", key: "" }; }
    catch (e) { return { provider: "openligadb", key: "" }; }
  }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }

  // ---------- 真实接口响应 → 内部统一结构 ----------
  function mapOpenLiga(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 12).map(function (m, i) {
      var t1 = m.Team1 ? m.Team1.TeamName : "?", t2 = m.Team2 ? m.Team2.TeamName : "?";
      var res = m.MatchResults && m.MatchResults[0];
      var score = res ? res.PointsTeam1 + "-" + res.PointsTeam2 : "VS";
      var dt = m.MatchDateTime ? m.MatchDateTime.replace("T", " ").slice(0, 16) : "";
      var fin = !!m.MatchIsFinished;
      return {
        id: "ol" + m.MatchID, league: "德甲 Bundesliga", home: t1, away: t2,
        time: dt, status: fin ? "完场" : "未开赛", score: fin ? score : "VS", hot: i < 3,
        source: "openligadb"
      };
    });
  }
  function mapFootballData(obj) {
    var arr = (obj && obj.matches) || [];
    return arr.slice(0, 12).map(function (m, i) {
      var t1 = m.homeTeam ? m.homeTeam.name : "?", t2 = m.awayTeam ? m.awayTeam.name : "?";
      var fin = m.status === "FINISHED";
      var ft = fin && m.score && m.score.fullTime;
      var score = ft ? ft.home + "-" + ft.away : "VS";
      return {
        id: "fd" + m.id, league: (m.competition && m.competition.name) || "联赛",
        home: t1, away: t2, time: (m.utcDate || "").replace("T", " ").slice(0, 16),
        status: fin ? "完场" : (m.status === "IN_PLAY" ? "进行中" : "未开赛"),
        score: fin ? score : "VS", hot: i < 3, source: "football_data"
      };
    });
  }

  // 把 "58%" / "12" / null 统一成数值
  function num(v) {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    var s = String(v).replace("%", "").replace(",", "").trim();
    return parseFloat(s) || 0;
  }
  // 从 statistics 数组里按 type 取值
  function statOf(stats, type) {
    if (!stats) return 0;
    var f = stats.find(function (x) { return x.type === type; });
    return f ? num(f.value) : 0;
  }

  // API-Football 赛程 → 内部列表
  function mapApiFootballList(obj) {
    var arr = (obj && obj.response) || [];
    return arr.slice(0, 12).map(function (f, i) {
      var fin = f.fixture && f.fixture.status && f.fixture.status.short === "FT";
      var live = f.fixture && f.fixture.status && f.fixture.status.short === "FT" ? false :
        (f.fixture && f.fixture.status && f.fixture.status.short === "LIVE");
      var g = f.goals || {};
      var score = (g.home != null && g.away != null) ? g.home + "-" + g.away : "VS";
      var shortStatus = f.fixture && f.fixture.status ? f.fixture.status.short : "";
      var statusTxt = fin ? "完场" : (live ? "进行中" : "未开赛");
      return {
        id: "af" + (f.fixture ? f.fixture.id : i),
        league: (f.league && f.league.name) || "联赛",
        home: f.teams && f.teams.home ? f.teams.home.name : "?",
        away: f.teams && f.teams.away ? f.teams.away.name : "?",
        time: (f.fixture && f.fixture.date || "").replace("T", " ").slice(0, 16),
        status: statusTxt, score: score, hot: i < 3, source: "api_football"
      };
    });
  }

  // 把 API-Football 的 statistics / xg / events 拼成 FB.MATCH 形状
  // 注意：events 不含球场坐标，射门 x/y 为按球队进攻方向估算的「近似坐标」，仅用于可视化占位
  function mapApiFootballMatch(fixture, stats, xg, events) {
    if (!fixture) return null;
    var homeName = fixture.teams && fixture.teams.home ? fixture.teams.home.name : "主队";
    var awayName = fixture.teams && fixture.teams.away ? fixture.teams.away.name : "客队";
    var g = fixture.goals || {};
    var labels = ["控球率", "射门", "射正", "传球", "传球成功率", "角球", "犯规"];
    var homeStats = stats && stats[0] ? stats[0].statistics : null;
    var awayStats = stats && stats[1] ? stats[1].statistics : null;
    var homeXg = xg && xg[0] ? num(xg[0].xg) : 0;
    var awayXg = xg && xg[1] ? num(xg[1].xg) : 0;
    var statsArr = [
      statOf(homeStats, "Possession"), statOf(homeStats, "Total Shots"), statOf(homeStats, "Shots on Goal"),
      statOf(homeStats, "Passes"), statOf(homeStats, "Pass Accuracy"), statOf(homeStats, "Corners"), statOf(homeStats, "Fouls"),
      statOf(awayStats, "Possession"), statOf(awayStats, "Total Shots"), statOf(awayStats, "Shots on Goal"),
      statOf(awayStats, "Passes"), statOf(awayStats, "Pass Accuracy"), statOf(awayStats, "Corners"), statOf(awayStats, "Fouls")
    ];
    // 射门事件 → 近似坐标
    var shotsHome = [], shotsAway = [];
    (events || []).forEach(function (e) {
      if (e.type !== "Shot" && e.type !== "Goal") return;
      var isHome = fixture.teams && e.team && fixture.teams.home && e.team.name === fixture.teams.home.name;
      var r = e.type === "Goal" ? "goal" :
        (e.detail === "Saved Shot" ? "saved" : e.detail === "Post" ? "post" : "miss");
      var eh = num((e.time && e.time.elapsed) || 0);
      var y = 18 + ((eh * 37) % 64);                 // 用时间做确定性散布
      var x = isHome ? (84 + ((eh * 7) % 12)) : (16 - ((eh * 7) % 12)); // 主队攻右、客队攻左
      var sxg = r === "goal" ? 0.42 : r === "saved" ? 0.22 : r === "post" ? 0.18 : 0.12;
      var obj = { x: x, y: y, xg: sxg, r: r, m: eh };
      if (isHome) shotsHome.push(obj); else shotsAway.push(obj);
    });
    return {
      home: { name: homeName, short: homeName.slice(0, 2), color: "#185FA5", score: g.home != null ? g.home : 0, xg: homeXg },
      away: { name: awayName, short: awayName.slice(0, 2), color: "#A32D2D", score: g.away != null ? g.away : 0, xg: awayXg },
      competition: (fixture.league && fixture.league.name) || "", date: (fixture.fixture && fixture.fixture.date || "").slice(0, 10),
      stats: { labels: labels, home: statsArr.slice(0, 7), away: statsArr.slice(7, 14), unit: ["%", "", "", "", "%", "", ""] },
      // xG 时间线无官方接口，用终点 xG 做两端插值，仅供可视化
      xgTimeline: [
        { m: 0, h: 0, a: 0 },
        { m: 45, h: +(homeXg * 0.45).toFixed(2), a: +(awayXg * 0.45).toFixed(2) },
        { m: 90, h: +homeXg.toFixed(2), a: +awayXg.toFixed(2) }
      ],
      shots: { home: shotsHome, away: shotsAway },
      _approxShots: true, _real: true
    };
  }

  // ---------- 数据源（provider） ----------
  var providers = {
    mock: {
      key: "mock", name: "示例数据（离线·默认）", needKey: false,
      list: function () { return Promise.resolve(FB.MATCHES); },
      match: function (id) { return Promise.resolve((FB.MATCHES.find(function (x) { return x.id === id; }) || null)); }
    },
    openligadb: {
      key: "openligadb", name: "OpenLigaDB · 德甲真实数据（免费·无需 Key）", needKey: false,
      list: function () {
        return fetch("https://api.openligadb.de/getmatchdata/bl1")
          .then(function (r) { return r.json(); }).then(mapOpenLiga)
          .catch(function () { return FB.MATCHES; });  // 离线/请求失败回退示例，避免卡加载
      },
      // 免费接口提供真实赛程/比分，不含 xG/射门坐标；拉详情仅展示球队与比分
      match: function (id) {
        var mid = String(id).replace(/^ol/, "");
        return fetch("https://api.openligadb.de/getmatchdata/" + mid)
          .then(function (r) { return r.json(); })
          .then(function (arr) {
            var m = Array.isArray(arr) ? arr[0] : arr;
            if (!m) return null;
            var res = m.MatchResults && m.MatchResults[0];
            var fin = !!m.MatchIsFinished;
            var score = res ? res.PointsTeam1 + "-" + res.PointsTeam2 : "VS";
            return {
              home: { name: m.Team1 ? m.Team1.TeamName : "?", score: res ? res.PointsTeam1 : 0 },
              away: { name: m.Team2 ? m.Team2.TeamName : "?", score: res ? res.PointsTeam2 : 0 },
              competition: m.LeagueName || "德甲 Bundesliga",
              date: (m.MatchDateTime || "").replace("T", " ").slice(0, 16),
              score: score, finished: fin, source: "openligadb", _real: true
            };
          }).catch(function () { return null; });
      }
    },
    football_data: {
      key: "football_data", name: "football-data.org（需 API Key）", needKey: true,
      list: function (apiKey) {
        return fetch("https://api.football-data.org/v4/matches?limit=12", { headers: { "X-Auth-Token": apiKey } })
          .then(function (r) { return r.json(); }).then(mapFootballData);
      },
      match: function () { return Promise.resolve(null); }
    },
    api_football: {
      key: "api_football", name: "API-Football (api-sports.io) · 高级源（xG/统计/射门·需 Key）", needKey: true,
      list: function (apiKey) {
        var u = "https://v3.football.api-sports.io/fixtures?league=" + AF_LEAGUE + "&season=" + AF_SEASON;
        return fetch(u, { headers: { "x-apisports-key": apiKey } })
          .then(function (r) { return r.json(); }).then(mapApiFootballList);
      },
      match: function (id) {
        var cfg = load(), key = cfg.key;
        var fid = String(id).replace(/^af/, "");
        var h = { "x-apisports-key": key };
        function get(u) { return fetch(u, { headers: h }).then(function (r) { return r.json(); }); }
        return Promise.all([
          get("https://v3.football.api-sports.io/fixtures?id=" + fid),
          get("https://v3.football.api-sports.io/fixtures/statistics?fixture=" + fid),
          get("https://v3.football.api-sports.io/fixtures/xg?fixture=" + fid),
          get("https://v3.football.api-sports.io/fixtures/events?fixture=" + fid)
        ]).then(function (res) {
          var fx = res[0] && res[0].response && res[0].response[0];
          var st = (res[1] && res[1].response) || [];
          var xg = (res[2] && res[2].response) || [];
          var ev = (res[3] && res[3].response) || [];
          return mapApiFootballMatch(fx, st, xg, ev);
        }).catch(function () { return null; });
      }
    }
  };

  function getProvider() { var c = load(); return providers[c.provider] || providers.mock; }

  function listMatches() {
    var c = load(), p = getProvider();
    try { return p.list(c.key); } catch (e) { return Promise.resolve(FB.MATCHES); }
  }
  function getMatch(id) {
    var p = getProvider();
    try { return p.match(id); } catch (e) { return Promise.resolve(null); }
  }
  function test() {
    var c = load(), p = getProvider();
    if (p.needKey && !c.key) return Promise.resolve({ ok: false, msg: "该数据源需要 API Key" });
    return p.list(c.key).then(function (list) {
      return { ok: Array.isArray(list) && list.length > 0, msg: "成功获取 " + (list ? list.length : 0) + " 场", sample: list && list[0] };
    }).catch(function (e) { return { ok: false, msg: "请求失败：" + (e && e.message ? e.message : e) }; });
  }

  return { providers: providers, load: load, save: save, listMatches: listMatches, getMatch: getMatch, test: test };
})();
