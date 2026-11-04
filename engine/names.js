// 名字：台灣、新加坡（華人、馬來、印度）。同一份報告裡，每個人只用一次（現有的家人除外，見 cast.js）。
const TW_SUR = '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周徐蘇葉莊呂江何蕭羅高潘簡朱鍾游彭詹胡施沈余盧梁趙顏柯翁魏孫戴范方宋鄧杜傅侯曹薛丁卓阮馬董温唐藍石蔣古紀姚連馮歐程湯黃田康姜白汪鄒尤巫鐘黎涂龔嚴韓袁金童陸夏柳凃邵錢伍倪溫于譚駱熊任甘秦顧毛章史官萬俞雷粘饒張闕凌崔尹孔辛武辜陶段龍韋葛池孟褚殷麥賀賈莫文管關向包丘梅華裴利翟黃'.split('');
const TW_M = '家豪 志明 俊傑 建宏 冠宇 承恩 宇軒 柏翰 彥廷 冠廷 宗翰 志豪 信宏 品睿 子翔 浩宇 培倫 立偉 文彬 國華 振宇 明哲 育誠 致遠 威廷 哲維 嘉偉 俊宏 士豪 睿恩 宥辰 晨皓 宇恩 柏宇 承翰 宏達 偉倫 世昌 正雄 文雄 建志 永福 金龍 俊男 耀文 光明 子豪 定遠 少華 廷安'.split(' ');
const TW_F = '怡君 雅婷 佳穎 欣怡 淑芬 美玲 宜蓁 詩涵 郁婷 佩珊 雅雯 惠如 曉芬 瑋婷 筱涵 品妤 子晴 語彤 芷若 思妤 宜庭 婉婷 心怡 家瑜 舒涵 彥君 靜怡 秀英 麗華 玉蘭 春梅 素珍 月娥 淑惠 美惠 筱婷 芳瑜 佳蓉 怡萱 采潔 宥蓁 若彤 雨柔 恩綺 安琪 佳慧 慧君 宛儒 映彤 玟慧'.split(' ');
const SG_CN_SUR = '陳林黃李張王吳楊蔡鄭許謝郭何梁劉'.split('');
const SG_CN_M = '偉強 志偉 俊傑 家明 振華 國豪 健明 嘉俊'.split(' ');
const SG_CN_F = '慧敏 美琳 麗萍 婉婷 詩敏 曉琳 佩儀 欣妍'.split(' ');
const SG_MY_M = ['Muhammad Faiz', 'Ahmad Hakim', 'Haziq Rahman', 'Irfan Yusof', 'Danial Osman', 'Syafiq Ismail'];
const SG_MY_F = ['Nur Aisyah', 'Siti Nadia', 'Farah Hanim', 'Nurul Huda', 'Aqilah Zainal', 'Syahirah Ali'];
const SG_IN_M = ['Ravi Kumar', 'Arjun Nair', 'Suresh Pillai', 'Vikram Raj', 'Karthik Menon', 'Deepak Singh'];
const SG_IN_F = ['Priya Devi', 'Anjali Raman', 'Kavitha Rao', 'Meera Iyer', 'Divya Nathan', 'Lakshmi Bala'];

const JP_SUR = '佐藤 鈴木 高橋 田中 伊藤 渡邊 山本 中村 小林 加藤 吉田 山田 佐佐木 山口 松本 井上 木村 林 清水 齋藤'.split(' ');
const JP_M = '翔太 大輔 拓也 健太 直樹 雄一 和也 浩二 誠 隆 悠斗 陽向 蓮 湊 大翔'.split(' ');
const JP_F = '美咲 陽子 由美 恵 真由美 彩 優子 愛 結衣 葵 陽菜 凜 美穗 沙織 千尋'.split(' ');
const EN_SUR = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Miller', 'Wilson', 'Moore', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Carter'];
const EN_M = ['James', 'Michael', 'David', 'Daniel', 'Matthew', 'Ryan', 'Kevin', 'Brian', 'Eric', 'Jason', 'Mark', 'Paul', 'Tom', 'Chris', 'Sam'];
const EN_F = ['Emily', 'Sarah', 'Jessica', 'Laura', 'Rachel', 'Hannah', 'Megan', 'Anna', 'Grace', 'Olivia', 'Emma', 'Sophie', 'Kate', 'Lucy', 'Amy'];
// 哪個國家用哪種名字：華人地區用台灣的名字池，新加坡混華、馬來、印度，日本用日本名字，其他用英語系名字（試跑先這樣）
const CHINESE = ['TWN', 'CHN', 'HKG', 'MAC'];
function styleOf(iso) { return iso === 'SGP' ? 'SG' : iso === 'JPN' ? 'JP' : CHINESE.includes(iso) || !iso ? 'TW' : 'EN'; }

function make(style, gender, rnd, used, surname) {
  for (let i = 0; i < 400; i++) {
    let n;
    if (style === 'SG') {
      const r = rnd();
      if (r < 0.6) n = SG_CN_SUR[Math.floor(rnd() * SG_CN_SUR.length)] + (gender === 'F' ? SG_CN_F : SG_CN_M)[Math.floor(rnd() * 8)];
      else if (r < 0.8) n = (gender === 'F' ? SG_MY_F : SG_MY_M)[Math.floor(rnd() * 6)];
      else n = (gender === 'F' ? SG_IN_F : SG_IN_M)[Math.floor(rnd() * 6)];
    } else if (style === 'JP') {
      n = JP_SUR[Math.floor(rnd() * JP_SUR.length)] + (gender === 'F' ? JP_F : JP_M)[Math.floor(rnd() * 15)];
    } else if (style === 'EN') {
      n = (gender === 'F' ? EN_F : EN_M)[Math.floor(rnd() * 15)] + ' ' + EN_SUR[Math.floor(rnd() * EN_SUR.length)];
    } else {
      const s = surname || TW_SUR[Math.floor(rnd() * TW_SUR.length)];
      n = s + (gender === 'F' ? TW_F : TW_M)[Math.floor(rnd() * (gender === 'F' ? TW_F.length : TW_M.length))];
    }
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = '小' + (used.size + 1); used.add(n); return n;
}
module.exports = { make, TW_SUR, styleOf };
