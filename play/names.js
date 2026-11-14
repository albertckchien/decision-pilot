// 隨機投胎的名字（2026-11-15）：依國家或區域挑一組當地常見的名字。只用一般人的名字，不用名人。
// 華人、日本、韓國寫中文字；其他用當地常見的拼法。名字用另外一條亂數，不影響人生的結果。
(function (root) {
'use strict';
const S = s => s.split(' ');
// 每組：[姓, 男名, 女名, 順序]；順序 'sg'＝姓在前不空格（中、日、韓），'gs'＝名在前、空格隔開，'sp'＝姓在前、空格隔開（越南）
const P = {
  zh: [S('陳 林 黃 張 李 王 吳 劉 蔡 楊 許 鄭 謝 郭 洪 曾 邱 廖 賴 周 徐 蘇 葉 莊 呂 江 何 蕭 羅 高'),
       S('家豪 志明 俊傑 建宏 冠宇 承恩 宇軒 柏翰 彥廷 宗翰 信宏 品睿 子翔 浩宇 明哲 致遠 文彬 國華'),
       S('怡君 雅婷 佳穎 欣怡 淑芬 美玲 宜蓁 詩涵 郁婷 佩珊 雅雯 惠如 子晴 語彤 思妤 宜庭 婉婷 心怡'), 'sg'],
  cn: [S('王 李 張 劉 陳 楊 黃 趙 吳 周 徐 孫 馬 朱 胡 郭 何 林 高 羅 鄭 梁 宋 唐 許 韓 馮 鄧 曹 彭'),
       S('浩然 子豪 宇航 俊傑 志強 建國 偉 磊 鵬 博文 天宇 明輝 浩宇 子軒 志剛 海濤 曉東 文傑'),
       S('欣怡 雨涵 詩琪 婷婷 靜 麗娜 曉燕 佳怡 夢瑤 子涵 秀英 慧敏 雪 丹丹 嘉欣 思琪 玉蘭 紅梅'), 'sg'],
  ja: [S('佐藤 鈴木 高橋 田中 伊藤 渡邊 山本 中村 小林 加藤 吉田 山田 松本 井上 木村 林 清水 齋藤'),
       S('翔太 大輔 拓也 健太 直樹 雄一 和也 浩二 誠 隆 悠斗 陽向 蓮 湊 大翔'), S('美咲 陽子 由美 恵 真由美 彩 優子 愛 結衣 葵 陽菜 凜 沙織 千尋'), 'sg'],
  ko: [S('金 李 朴 崔 鄭 姜 趙 尹 張 林 韓 吳 徐 申 權'), S('敏俊 書俊 智勳 俊浩 賢宇 東炫 成民 在勳 承宇 泰陽 宰賢 志勳'),
       S('書妍 敏智 秀賢 智恩 惠珍 恩貞 允書 夏恩 智妍 秀彬 藝琳 多恩'), 'sg'],
  vi: [S('Nguyễn Trần Lê Phạm Hoàng Huỳnh Phan Vũ Võ Đặng Bùi Đỗ'), S('Minh Tuấn, Văn Hùng, Đức Anh, Quốc Bảo, Thành Long, Hoàng Nam, Gia Huy, Văn Tài'.replace(/, /g, ',')).join(' ').split(','),
       'Thị Lan,Ngọc Anh,Thu Trang,Minh Thư,Thị Hoa,Bảo Ngọc,Phương Linh,Thanh Hương'.split(','), 'sp'],
  my: [S('Santoso Wijaya Pratama Saputra Hidayat Rahman Setiawan Nugroho Siregar Hassan Abdullah Ismail'),
       S('Budi Agus Rizky Dimas Ahmad Hafiz Andi Fajar Aditya Irfan Yusuf Danial'), S('Siti Dewi Putri Rina Nurul Ayu Fitri Aisyah Indah Wulan Farah Lestari'), 'gs'],
  th: [S('Saetang Srisuk Wongsa Chaiyaporn Boonmee Kaewkla Somsak Thongdee Rattana Phromma'),
       S('Somchai Anan Kittisak Prasert Chaiwat Narong Wichai Thanakorn Surachai Pongsak'), S('Siriporn Malee Kanya Ratana Somying Wanida Pimchanok Nattaya Supaporn Arunee'), 'gs'],
  ph: [S('Santos Reyes Cruz Bautista Garcia Mendoza Torres Flores Ramos Aquino Villanueva Castillo'),
       S('Juan Jose Mark John Paolo Carlo Miguel Rafael Jerome Angelo'), S('Maria Ana Kristine Joy Angelica Camille Patricia Jasmine Rose Grace'), 'gs'],
  hi: [S('Kumar Sharma Singh Patel Yadav Verma Gupta Das Reddy Nair Iyer Mishra Joshi Pillai Rao'),
       S('Ravi Amit Rahul Suresh Vikram Arjun Rohit Sanjay Deepak Anil Manoj Rajesh Karthik Ajay'), S('Priya Anjali Pooja Neha Sunita Kavita Meera Lakshmi Divya Anita Rekha Sneha Deepa Asha'), 'gs'],
  sa: [S('Khan Ahmed Hussain Ali Rahman Chowdhury Islam Iqbal Malik Qureshi Hossain Butt'),
       S('Muhammad Ali Hassan Imran Bilal Usman Rashid Kamal Tariq Salman Rafiq Sohel'), S('Ayesha Fatima Sana Nadia Rubina Shabnam Farzana Hina Sadia Nasreen Taslima Rukhsana'), 'gs'],
  ar: [S('Hassan Ali Ahmed Ibrahim Mahmoud Saleh Khalil Mansour Haddad Youssef Nasser Rashid'),
       S('Ahmed Mohamed Omar Khaled Youssef Karim Tarek Hamza Samir Mahmoud Ali Hussein'), S('Fatima Aisha Mariam Nour Layla Huda Rania Salma Amira Zainab Yasmin Hana'), 'gs'],
  fa: [S('Ahmadi Hosseini Rezaei Mohammadi Karimi Moradi Jafari Rahimi Ghasemi Sadeghi'),
       S('Reza Ali Hossein Mehdi Amir Saeed Hamid Mohsen Behnam Farhad'), S('Maryam Zahra Fatemeh Narges Sara Leila Mina Parisa Shirin Roya'), 'gs'],
  he: [S('Cohen Levi Mizrahi Peretz Biton Friedman Katz Azoulay Shapiro Ben-David'),
       S('Yosef Daniel David Noam Itai Omer Ariel Yonatan Eitan Amir'), S('Noa Tamar Maya Shira Yael Michal Adi Avigail Rivka Hila'), 'gs'],
  tr: [S('Yılmaz Kaya Demir Şahin Çelik Yıldız Öztürk Aydın Arslan Doğan Kılıç Aslan'),
       S('Mehmet Mustafa Ahmet Ali Hüseyin Emre Burak Murat Can Yusuf'), S('Ayşe Fatma Zeynep Elif Emine Hatice Merve Büşra Esra Selin'), 'gs'],
  wa: [S('Okafor Adeyemi Mensah Bello Musa Eze Okonkwo Boateng Owusu Abubakar Nwosu Adebayo Danjuma Asante'),
       S('Chinedu Emeka Tunde Kwame Ibrahim Musa Olumide Kofi Yaw Babajide Abdullahi Chukwudi'), S('Ngozi Amina Funmilayo Ama Aisha Chioma Abena Blessing Halima Folake Adaeze Esi'), 'gs'],
  sh: [S('Diallo Traoré Coulibaly Keïta Diop Ndiaye Sow Ouédraogo Cissé Touré Maïga Sylla'),
       S('Moussa Mamadou Ousmane Ibrahima Abdoulaye Amadou Souleymane Cheikh Boubacar Issa'), S('Fatoumata Aminata Mariam Awa Kadiatou Aïssatou Hawa Ramatou Fanta Adama'), 'gs'],
  cf: [S('Mbuyi Kabongo Ilunga Ngoy Mukendi Tshibangu Nkounkou Mbarga Essomba Ndong Nzeyimana Habimana'),
       S('Jean Patrick Emmanuel Joseph Christian Didier Serge Blaise Olivier Eric'), S('Marie Grâce Chantal Josiane Clarisse Esther Nadine Solange Béatrice Odile'), 'gs'],
  ea: [S('Mwangi Otieno Kamau Wanjiku Ochieng Njoroge Kiprono Mushi Mollel Nakato Okello Mugisha'),
       S('Juma Baraka Peter John Joseph Daniel Emmanuel Samuel Hassan Brian Kevin Moses'), S('Wanjiru Akinyi Neema Grace Mary Esther Faith Rehema Amani Zawadi Halima Joyce'), 'gs'],
  et: [S('Bekele Haile Tesfaye Gebre Alemu Mekonnen Tadesse Girma Kebede Wolde'),
       S('Abebe Dawit Yonas Solomon Henok Tewodros Bereket Samuel Mulugeta Getachew'), S('Tigist Almaz Selam Hiwot Meseret Bethlehem Liya Eden Rahel Mekdes'), 'gs'],
  za: [S('Nkosi Dlamini Ndlovu Khumalo Mokoena Mahlangu Sithole Moyo Mabaso Molefe Zulu Ngcobo'),
       S('Thabo Sipho Themba Bongani Lungile Kagiso Tshepo Mandla Sibusiso Tendai'), S('Lerato Thandiwe Nomvula Zanele Palesa Nandi Busisiwe Rudo Precious Naledi'), 'gs'],
  es: [S('García López Martínez Rodríguez Hernández González Pérez Sánchez Ramírez Torres Flores Gómez Díaz Morales'),
       S('José Juan Carlos Luis Miguel Jorge Diego Andrés Javier Alejandro Fernando Santiago'), S('María Ana Laura Sofía Carmen Daniela Valentina Gabriela Lucía Isabel Camila Paula'), 'gs'],
  pt: [S('Silva Santos Oliveira Souza Pereira Costa Rodrigues Almeida Lima Ferreira Carvalho Gomes'),
       S('João Pedro Lucas Gabriel Rafael Mateus Felipe Thiago Bruno Gustavo'), S('Ana Maria Juliana Beatriz Fernanda Larissa Camila Mariana Letícia Gabriela'), 'gs'],
  fr: [S('Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Laurent Girard'),
       S('Lucas Hugo Louis Thomas Nicolas Julien Antoine Pierre Mathieu Maxime'), S('Emma Léa Camille Chloé Manon Julie Sarah Marie Claire Pauline'), 'gs'],
  de: [S('Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Bauer'),
       S('Lukas Jonas Felix Maximilian Paul Leon Tobias Jan Stefan Florian'), S('Anna Lena Laura Julia Sarah Lisa Hannah Katharina Sophie Marie'), 'gs'],
  it: [S('Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco'),
       S('Marco Luca Giuseppe Francesco Alessandro Andrea Matteo Lorenzo Davide Simone'), S('Giulia Francesca Chiara Sara Martina Valentina Elena Alessia Federica Sofia'), 'gs'],
  pl: [S('Nowak Kowalski Wiśniewski Wójcik Kowalczyk Kamiński Lewandowski Zieliński Szymański Dąbrowski'),
       S('Piotr Krzysztof Tomasz Paweł Michał Marcin Jakub Kamil Adam Łukasz'), S('Anna Katarzyna Magdalena Agnieszka Joanna Monika Natalia Karolina Zofia Ewa'), 'gs'],
  ru: [S('Ivanov Smirnov Kuznetsov Popov Vasiliev Petrov Sokolov Mikhailov Novikov Fedorov'),
       S('Dmitri Alexei Sergei Andrei Ivan Mikhail Nikolai Pavel Artem Maxim'), S('Anna Elena Olga Natalia Tatiana Maria Irina Svetlana Ekaterina Daria'), 'gs'],
  ca: [S('Karimov Yusupov Abdullaev Nurlanov Toktogulov Rakhimov Saidov Akhmedov Bekov Ismailov'),
       S('Rustam Aibek Timur Bakhtiyar Nurlan Farrukh Azamat Bekzod Daniyar Alisher'), S('Dilnoza Aigerim Madina Gulnara Nilufar Zarina Aliya Kamila Malika Saule'), 'gs'],
  mn: [S('Bat Dorj Ganbaatar Tsogt Enkh Batbayar Sukh Erdene Munkh Altan'),
       S('Bat-Erdene Ganzorig Temuujin Batbold Enkhbayar Tömör Bilguun Munkhbat'), S('Oyuntsetseg Narantsetseg Solongo Altantsetseg Enkhjargal Saruul Anujin Nomin'), 'gs'],
  eu: [S('Novak Horvat Larsen Jensen Andersson Nielsen Popescu Ionescu Kovács Nagy Papadopoulos Janssen'),
       S('Erik Jan Peter Martin Ivan Nikola Andrei Lars Mihai Tomas Bence Nikos'), S('Anna Eva Maria Elena Sofia Ingrid Petra Ioana Katerina Lena Zsófia Hanna'), 'gs'],
  en: [S('Smith Johnson Brown Taylor Miller Wilson Moore Clark Lewis Walker Hall Young King Wright Scott Green Baker Adams'),
       S('James Michael David Daniel Matthew Ryan Kevin Brian Eric Jason Mark Paul Tom Chris Sam'), S('Emily Sarah Jessica Laura Rachel Hannah Megan Anna Grace Olivia Emma Sophie Kate Lucy Amy'), 'gs']
};
const BY = {
  zh: 'TWN HKG MAC SGP', cn: 'CHN', ja: 'JPN', ko: 'KOR PRK', vi: 'VNM', my: 'IDN MYS BRN TLS', th: 'THA LAO KHM MMR', ph: 'PHL',
  hi: 'IND NPL LKA BTN', sa: 'PAK BGD AFG MDV', fa: 'IRN TJK', he: 'ISR', tr: 'TUR AZE', mn: 'MNG',
  wa: 'NGA GHA LBR SLE GMB GNB TGO BEN CIV', sh: 'MLI SEN NER BFA GIN MRT TCD', cf: 'COD COG CMR GAB CAF BDI RWA HTI',
  ea: 'KEN TZA UGA SSD', et: 'ETH ERI', za: 'ZAF LSO SWZ BWA NAM ZWE ZMB MWI MOZ', ar: 'SDN SOM DJI',
  pt: 'BRA PRT AGO CPV STP', es: 'ESP', fr: 'FRA BEL LUX MCO', de: 'DEU AUT CHE LIE', it: 'ITA SMR', pl: 'POL',
  ru: 'RUS UKR BLR MDA', ca: 'KAZ UZB KGZ TKM', en: 'USA GBR IRL CAN AUS NZL JAM TTO BHS BRB'
};
const ISO = {}; Object.entries(BY).forEach(([k, v]) => v.split(' ').forEach(i => { ISO[i] = k; }));
const REGION = { 'South Asia': 'hi', 'Middle East, North Africa, Afghanistan & Pakistan': 'ar', 'Middle East & North Africa': 'ar', 'Sub-Saharan Africa': 'wa', 'Latin America & Caribbean': 'es',
  'Europe & Central Asia': 'eu', 'North America': 'en', 'East Asia & Pacific': 'en' };
function styleOf(C) { return ISO[C.iso] || REGION[C.region] || 'en'; }
// 這一國有對到名字組（指定國家或區域），不是掉到預設的英文名字
function known(C) { return !!(ISO[C.iso] || REGION[C.region]); }
// r：0～1 的亂數函式；sex：'M'／'F'
function nameFor(C, sex, r) {
  const [sur, m, f, order] = P[styleOf(C)], pick = a => a[Math.floor(r() * a.length)];
  const s = pick(sur), g = pick(sex === 'F' ? f : m);
  return order === 'sg' ? s + g : order === 'sp' ? s + ' ' + g : g + ' ' + s;
}
const api = { nameFor, styleOf, known, POOLS: P };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PlayNames = api;
})(typeof window !== 'undefined' ? window : globalThis);
