// Cities: name|country|IANA zone|lat|lon[|aliases]. Used for time-zone search, sunrise/sunset and locale defaults.
const RAW = `
London|GB|Europe/London|51.51|-0.13|uk,england,britain
Manchester|GB|Europe/London|53.48|-2.24
Edinburgh|GB|Europe/London|55.95|-3.19|scotland
Dublin|IE|Europe/Dublin|53.35|-6.26|ireland
Paris|FR|Europe/Paris|48.86|2.35|france
Nanterre|FR|Europe/Paris|48.89|2.21
Lyon|FR|Europe/Paris|45.76|4.84
Marseille|FR|Europe/Paris|43.30|5.37
Toulouse|FR|Europe/Paris|43.60|1.44
Nice|FR|Europe/Paris|43.70|7.27
Bordeaux|FR|Europe/Paris|44.84|-0.58
Lille|FR|Europe/Paris|50.63|3.06
Nantes|FR|Europe/Paris|47.22|-1.55
Strasbourg|FR|Europe/Paris|48.57|7.75
Montpellier|FR|Europe/Paris|43.61|3.88
Rennes|FR|Europe/Paris|48.11|-1.68
Brussels|BE|Europe/Brussels|50.85|4.35|belgium,bruxelles
Amsterdam|NL|Europe/Amsterdam|52.37|4.90|netherlands,holland
Rotterdam|NL|Europe/Amsterdam|51.92|4.48
Luxembourg|LU|Europe/Luxembourg|49.61|6.13
Geneva|CH|Europe/Zurich|46.20|6.14|geneve,genève
Zurich|CH|Europe/Zurich|47.38|8.54|switzerland,zürich
Berlin|DE|Europe/Berlin|52.52|13.40|germany
Munich|DE|Europe/Berlin|48.14|11.58|münchen
Frankfurt|DE|Europe/Berlin|50.11|8.68
Hamburg|DE|Europe/Berlin|53.55|9.99
Cologne|DE|Europe/Berlin|50.94|6.96|köln
Vienna|AT|Europe/Vienna|48.21|16.37|austria,wien
Madrid|ES|Europe/Madrid|40.42|-3.70|spain
Barcelona|ES|Europe/Madrid|41.39|2.17
Seville|ES|Europe/Madrid|37.39|-5.98|sevilla
Valencia|ES|Europe/Madrid|39.47|-0.38
Málaga|ES|Europe/Madrid|36.72|-4.42|malaga
Palma de Mallorca|ES|Europe/Madrid|39.57|2.65|mallorca
Las Palmas|ES|Atlantic/Canary|28.12|-15.44|canary islands,gran canaria,tenerife
Lisbon|PT|Europe/Lisbon|38.72|-9.14|portugal,lisboa
Porto|PT|Europe/Lisbon|41.15|-8.61
Funchal|PT|Atlantic/Madeira|32.65|-16.91|madeira
Ponta Delgada|PT|Atlantic/Azores|37.74|-25.67|azores
Rome|IT|Europe/Rome|41.90|12.50|italy,roma
Milan|IT|Europe/Rome|45.46|9.19|milano
Naples|IT|Europe/Rome|40.85|14.27|napoli
Venice|IT|Europe/Rome|45.44|12.32|venezia
Florence|IT|Europe/Rome|43.77|11.26|firenze
Monaco|MC|Europe/Monaco|43.74|7.42
Copenhagen|DK|Europe/Copenhagen|55.68|12.57|denmark
Stockholm|SE|Europe/Stockholm|59.33|18.07|sweden
Oslo|NO|Europe/Oslo|59.91|10.75|norway
Helsinki|FI|Europe/Helsinki|60.17|24.94|finland
Reykjavik|IS|Atlantic/Reykjavik|64.15|-21.94|iceland
Warsaw|PL|Europe/Warsaw|52.23|21.01|poland,warszawa
Krakow|PL|Europe/Warsaw|50.06|19.94|kraków
Prague|CZ|Europe/Prague|50.08|14.44|czechia,praha
Budapest|HU|Europe/Budapest|47.50|19.04|hungary
Bratislava|SK|Europe/Bratislava|48.15|17.11|slovakia
Ljubljana|SI|Europe/Ljubljana|46.06|14.51|slovenia
Zagreb|HR|Europe/Zagreb|45.81|15.98|croatia
Split|HR|Europe/Zagreb|43.51|16.44
Belgrade|RS|Europe/Belgrade|44.79|20.45|serbia
Sarajevo|BA|Europe/Sarajevo|43.86|18.41|bosnia
Podgorica|ME|Europe/Podgorica|42.44|19.26|montenegro
Tirana|AL|Europe/Tirane|41.33|19.82|albania
Skopje|MK|Europe/Skopje|42.00|21.43|macedonia
Sofia|BG|Europe/Sofia|42.70|23.32|bulgaria
Bucharest|RO|Europe/Bucharest|44.43|26.10|romania
Chisinau|MD|Europe/Chisinau|47.01|28.86|moldova
Athens|GR|Europe/Athens|37.98|23.73|greece
Valletta|MT|Europe/Malta|35.90|14.51|malta
Nicosia|CY|Asia/Nicosia|35.17|33.36|cyprus
Andorra la Vella|AD|Europe/Andorra|42.51|1.52|andorra
Istanbul|TR|Europe/Istanbul|41.01|28.98|turkey,türkiye
Ankara|TR|Europe/Istanbul|39.93|32.86
Antalya|TR|Europe/Istanbul|36.90|30.70
Kyiv|UA|Europe/Kyiv|50.45|30.52|ukraine,kiev
Minsk|BY|Europe/Minsk|53.90|27.57|belarus
Moscow|RU|Europe/Moscow|55.76|37.62|russia,moskva
Saint Petersburg|RU|Europe/Moscow|59.93|30.34|st petersburg
Kaliningrad|RU|Europe/Kaliningrad|54.71|20.51
Samara|RU|Europe/Samara|53.20|50.15
Riga|LV|Europe/Riga|56.95|24.11|latvia
Tallinn|EE|Europe/Tallinn|59.44|24.75|estonia
Vilnius|LT|Europe/Vilnius|54.69|25.28|lithuania
Casablanca|MA|Africa/Casablanca|33.57|-7.59|morocco,maroc
Rabat|MA|Africa/Casablanca|34.02|-6.84
Marrakech|MA|Africa/Casablanca|31.63|-7.99|marrakesh
Fes|MA|Africa/Casablanca|34.03|-5.00|fès,fez
Tangier|MA|Africa/Casablanca|35.76|-5.83|tanger
Agadir|MA|Africa/Casablanca|30.43|-9.60
Oujda|MA|Africa/Casablanca|34.68|-1.91
Algiers|DZ|Africa/Algiers|36.75|3.06|algeria,alger
Oran|DZ|Africa/Algiers|35.70|-0.63
Tunis|TN|Africa/Tunis|36.81|10.18|tunisia
Tripoli|LY|Africa/Tripoli|32.89|13.19|libya
Cairo|EG|Africa/Cairo|30.04|31.24|egypt
Alexandria|EG|Africa/Cairo|31.20|29.92
Khartoum|SD|Africa/Khartoum|15.50|32.56|sudan
Addis Ababa|ET|Africa/Addis_Ababa|9.03|38.74|ethiopia
Nairobi|KE|Africa/Nairobi|-1.29|36.82|kenya
Dar es Salaam|TZ|Africa/Dar_es_Salaam|-6.79|39.21|tanzania
Kampala|UG|Africa/Kampala|0.35|32.58|uganda
Kigali|RW|Africa/Kigali|-1.95|30.06|rwanda
Mogadishu|SO|Africa/Mogadishu|2.05|45.32|somalia
Djibouti|DJ|Africa/Djibouti|11.59|43.15
Lagos|NG|Africa/Lagos|6.52|3.38|nigeria
Abuja|NG|Africa/Lagos|9.08|7.40
Accra|GH|Africa/Accra|5.60|-0.19|ghana
Dakar|SN|Africa/Dakar|14.72|-17.47|senegal
Abidjan|CI|Africa/Abidjan|5.36|-4.01|ivory coast,côte d'ivoire
Bamako|ML|Africa/Bamako|12.64|-8.00|mali
Nouakchott|MR|Africa/Nouakchott|18.08|-15.98|mauritania
Douala|CM|Africa/Douala|4.05|9.77|cameroon
Libreville|GA|Africa/Libreville|0.42|9.47|gabon
Kinshasa|CD|Africa/Kinshasa|-4.44|15.27|congo
Luanda|AO|Africa/Luanda|-8.84|13.23|angola
Johannesburg|ZA|Africa/Johannesburg|-26.20|28.05|south africa
Cape Town|ZA|Africa/Johannesburg|-33.92|18.42
Durban|ZA|Africa/Johannesburg|-29.86|31.02
Windhoek|NA|Africa/Windhoek|-22.56|17.08|namibia
Gaborone|BW|Africa/Gaborone|-24.65|25.91|botswana
Harare|ZW|Africa/Harare|-17.83|31.05|zimbabwe
Lusaka|ZM|Africa/Lusaka|-15.39|28.32|zambia
Maputo|MZ|Africa/Maputo|-25.97|32.57|mozambique
Antananarivo|MG|Indian/Antananarivo|-18.88|47.51|madagascar
Port Louis|MU|Indian/Mauritius|-20.16|57.50|mauritius
Saint-Denis|RE|Indian/Reunion|-20.88|55.45|réunion,reunion
Dubai|AE|Asia/Dubai|25.20|55.27|uae,emirates
Abu Dhabi|AE|Asia/Dubai|24.45|54.38
Doha|QA|Asia/Qatar|25.29|51.53|qatar
Riyadh|SA|Asia/Riyadh|24.71|46.68|saudi arabia
Jeddah|SA|Asia/Riyadh|21.49|39.19
Mecca|SA|Asia/Riyadh|21.42|39.83|makkah
Medina|SA|Asia/Riyadh|24.47|39.61|madinah
Kuwait City|KW|Asia/Kuwait|29.38|47.99|kuwait
Manama|BH|Asia/Bahrain|26.23|50.59|bahrain
Muscat|OM|Asia/Muscat|23.59|58.41|oman
Tehran|IR|Asia/Tehran|35.69|51.39|iran
Baghdad|IQ|Asia/Baghdad|33.31|44.36|iraq
Amman|JO|Asia/Amman|31.95|35.93|jordan
Beirut|LB|Asia/Beirut|33.89|35.50|lebanon
Damascus|SY|Asia/Damascus|33.51|36.29|syria
Jerusalem|IL|Asia/Jerusalem|31.77|35.21|israel
Tel Aviv|IL|Asia/Jerusalem|32.09|34.78
Gaza|PS|Asia/Gaza|31.50|34.47|palestine
Sanaa|YE|Asia/Aden|15.37|44.19|yemen
Baku|AZ|Asia/Baku|40.41|49.87|azerbaijan
Tbilisi|GE|Asia/Tbilisi|41.72|44.79|georgia
Yerevan|AM|Asia/Yerevan|40.18|44.51|armenia
Karachi|PK|Asia/Karachi|24.86|67.01|pakistan
Lahore|PK|Asia/Karachi|31.55|74.34
Islamabad|PK|Asia/Karachi|33.68|73.05
Kabul|AF|Asia/Kabul|34.56|69.21|afghanistan
Tashkent|UZ|Asia/Tashkent|41.30|69.24|uzbekistan
Samarkand|UZ|Asia/Samarkand|39.65|66.96
Almaty|KZ|Asia/Almaty|43.24|76.89|kazakhstan
Astana|KZ|Asia/Almaty|51.17|71.43
Bishkek|KG|Asia/Bishkek|42.87|74.59|kyrgyzstan
Dushanbe|TJ|Asia/Dushanbe|38.56|68.79|tajikistan
Ashgabat|TM|Asia/Ashgabat|37.96|58.33|turkmenistan
New Delhi|IN|Asia/Kolkata|28.61|77.21|india,delhi
Mumbai|IN|Asia/Kolkata|19.08|72.88|bombay
Bangalore|IN|Asia/Kolkata|12.97|77.59|bengaluru
Kolkata|IN|Asia/Kolkata|22.57|88.36|calcutta
Chennai|IN|Asia/Kolkata|13.08|80.27|madras
Hyderabad|IN|Asia/Kolkata|17.39|78.49
Goa|IN|Asia/Kolkata|15.50|73.83
Kathmandu|NP|Asia/Kathmandu|27.72|85.32|nepal
Thimphu|BT|Asia/Thimphu|27.47|89.64|bhutan
Dhaka|BD|Asia/Dhaka|23.81|90.41|bangladesh
Colombo|LK|Asia/Colombo|6.93|79.86|sri lanka
Malé|MV|Indian/Maldives|4.18|73.51|maldives,male
Yangon|MM|Asia/Yangon|16.84|96.17|myanmar,burma,rangoon
Bangkok|TH|Asia/Bangkok|13.76|100.50|thailand
Phuket|TH|Asia/Bangkok|7.88|98.39
Chiang Mai|TH|Asia/Bangkok|18.79|98.98
Hanoi|VN|Asia/Ho_Chi_Minh|21.03|105.85|vietnam
Ho Chi Minh City|VN|Asia/Ho_Chi_Minh|10.82|106.63|saigon
Phnom Penh|KH|Asia/Phnom_Penh|11.56|104.92|cambodia
Vientiane|LA|Asia/Vientiane|17.98|102.63|laos
Kuala Lumpur|MY|Asia/Kuala_Lumpur|3.14|101.69|malaysia
Singapore|SG|Asia/Singapore|1.35|103.82
Jakarta|ID|Asia/Jakarta|-6.21|106.85|indonesia
Bali|ID|Asia/Makassar|-8.65|115.22|denpasar
Manila|PH|Asia/Manila|14.60|120.98|philippines
Hong Kong|HK|Asia/Hong_Kong|22.32|114.17
Macau|MO|Asia/Macau|22.20|113.54|macao
Taipei|TW|Asia/Taipei|25.03|121.57|taiwan
Beijing|CN|Asia/Shanghai|39.90|116.41|china,peking
Shanghai|CN|Asia/Shanghai|31.23|121.47
Shenzhen|CN|Asia/Shanghai|22.54|114.06
Guangzhou|CN|Asia/Shanghai|23.13|113.26|canton
Chengdu|CN|Asia/Shanghai|30.57|104.07
Seoul|KR|Asia/Seoul|37.57|126.98|korea,south korea
Busan|KR|Asia/Seoul|35.18|129.08
Pyongyang|KP|Asia/Pyongyang|39.04|125.76|north korea
Tokyo|JP|Asia/Tokyo|35.68|139.69|japan
Osaka|JP|Asia/Tokyo|34.69|135.50
Kyoto|JP|Asia/Tokyo|35.01|135.77
Sapporo|JP|Asia/Tokyo|43.06|141.35
Ulaanbaatar|MN|Asia/Ulaanbaatar|47.89|106.91|mongolia
Yekaterinburg|RU|Asia/Yekaterinburg|56.84|60.61
Omsk|RU|Asia/Omsk|54.99|73.37
Novosibirsk|RU|Asia/Novosibirsk|55.01|82.93
Krasnoyarsk|RU|Asia/Krasnoyarsk|56.01|92.85
Irkutsk|RU|Asia/Irkutsk|52.29|104.30
Yakutsk|RU|Asia/Yakutsk|62.03|129.73
Vladivostok|RU|Asia/Vladivostok|43.12|131.89
Magadan|RU|Asia/Magadan|59.56|150.80
Petropavlovsk-Kamchatsky|RU|Asia/Kamchatka|53.02|158.65|kamchatka
Sydney|AU|Australia/Sydney|-33.87|151.21|australia
Melbourne|AU|Australia/Melbourne|-37.81|144.96
Brisbane|AU|Australia/Brisbane|-27.47|153.03
Perth|AU|Australia/Perth|-31.95|115.86
Adelaide|AU|Australia/Adelaide|-34.93|138.60
Darwin|AU|Australia/Darwin|-12.46|130.84
Hobart|AU|Australia/Hobart|-42.88|147.33|tasmania
Canberra|AU|Australia/Sydney|-35.28|149.13
Auckland|NZ|Pacific/Auckland|-36.85|174.76|new zealand
Wellington|NZ|Pacific/Auckland|-41.29|174.78
Christchurch|NZ|Pacific/Auckland|-43.53|172.64
Chatham Islands|NZ|Pacific/Chatham|-43.95|-176.55
Suva|FJ|Pacific/Fiji|-18.14|178.44|fiji
Port Moresby|PG|Pacific/Port_Moresby|-9.44|147.18|papua new guinea
Nouméa|NC|Pacific/Noumea|-22.28|166.46|new caledonia,noumea
Papeete|PF|Pacific/Tahiti|-17.54|-149.57|tahiti,french polynesia
Honolulu|US|Pacific/Honolulu|21.31|-157.86|hawaii
Hagåtña|GU|Pacific/Guam|13.44|144.79|guam
Apia|WS|Pacific/Apia|-13.83|-171.76|samoa
Pago Pago|AS|Pacific/Pago_Pago|-14.28|-170.70|american samoa
Nukuʻalofa|TO|Pacific/Tongatapu|-21.14|-175.20|tonga
Kiritimati|KI|Pacific/Kiritimati|1.87|-157.43|christmas island,line islands
New York|US|America/New_York|40.71|-74.01|nyc,usa,united states
Washington DC|US|America/New_York|38.91|-77.04
Boston|US|America/New_York|42.36|-71.06
Philadelphia|US|America/New_York|39.95|-75.17
Miami|US|America/New_York|25.76|-80.19|florida
Orlando|US|America/New_York|28.54|-81.38
Atlanta|US|America/New_York|33.75|-84.39
Detroit|US|America/Detroit|42.33|-83.05
Toronto|CA|America/Toronto|43.65|-79.38|canada
Montreal|CA|America/Toronto|45.50|-73.57|montréal
Ottawa|CA|America/Toronto|45.42|-75.70
Quebec City|CA|America/Toronto|46.81|-71.21|québec
Halifax|CA|America/Halifax|44.65|-63.58
St. John's|CA|America/St_Johns|47.56|-52.71|newfoundland
Chicago|US|America/Chicago|41.88|-87.63
Houston|US|America/Chicago|29.76|-95.37|texas
Dallas|US|America/Chicago|32.78|-96.80
Austin|US|America/Chicago|30.27|-97.74
New Orleans|US|America/Chicago|29.95|-90.07
Minneapolis|US|America/Chicago|44.98|-93.27
Winnipeg|CA|America/Winnipeg|49.90|-97.14
Denver|US|America/Denver|39.74|-104.99|colorado
Salt Lake City|US|America/Denver|40.76|-111.89|utah
Phoenix|US|America/Phoenix|33.45|-112.07|arizona
Calgary|CA|America/Edmonton|51.05|-114.07
Edmonton|CA|America/Edmonton|53.55|-113.49
Los Angeles|US|America/Los_Angeles|34.05|-118.24|la,california
San Francisco|US|America/Los_Angeles|37.77|-122.42|sf,silicon valley
San Diego|US|America/Los_Angeles|32.72|-117.16
Las Vegas|US|America/Los_Angeles|36.17|-115.14
Seattle|US|America/Los_Angeles|47.61|-122.33
Portland|US|America/Los_Angeles|45.52|-122.68
Vancouver|CA|America/Vancouver|49.28|-123.12
Anchorage|US|America/Anchorage|61.22|-149.90|alaska
Mexico City|MX|America/Mexico_City|19.43|-99.13|mexico
Guadalajara|MX|America/Mexico_City|20.66|-103.35
Cancún|MX|America/Cancun|21.16|-86.85|cancun
Tijuana|MX|America/Tijuana|32.51|-117.04
Havana|CU|America/Havana|23.11|-82.37|cuba
Kingston|JM|America/Jamaica|17.97|-76.79|jamaica
Nassau|BS|America/Nassau|25.05|-77.36|bahamas
San Juan|PR|America/Puerto_Rico|18.47|-66.11|puerto rico
Santo Domingo|DO|America/Santo_Domingo|18.49|-69.93|dominican republic
Port-au-Prince|HT|America/Port-au-Prince|18.59|-72.31|haiti
Fort-de-France|MQ|America/Martinique|14.62|-61.06|martinique
Pointe-à-Pitre|GP|America/Guadeloupe|16.24|-61.53|guadeloupe
Cayenne|GF|America/Cayenne|4.92|-52.33|french guiana,guyane
Hamilton|BM|Atlantic/Bermuda|32.29|-64.78|bermuda
Panama City|PA|America/Panama|8.98|-79.52|panama
San José|CR|America/Costa_Rica|9.93|-84.08|costa rica
Guatemala City|GT|America/Guatemala|14.63|-90.51|guatemala
San Salvador|SV|America/El_Salvador|13.69|-89.22|el salvador
Tegucigalpa|HN|America/Tegucigalpa|14.07|-87.19|honduras
Managua|NI|America/Managua|12.11|-86.24|nicaragua
Bogotá|CO|America/Bogota|4.71|-74.07|colombia,bogota
Medellín|CO|America/Bogota|6.25|-75.56|medellin
Caracas|VE|America/Caracas|10.48|-66.90|venezuela
Quito|EC|America/Guayaquil|-0.18|-78.47|ecuador
Lima|PE|America/Lima|-12.05|-77.04|peru
La Paz|BO|America/La_Paz|-16.49|-68.12|bolivia
Santiago|CL|America/Santiago|-33.45|-70.67|chile
Buenos Aires|AR|America/Argentina/Buenos_Aires|-34.60|-58.38|argentina
Montevideo|UY|America/Montevideo|-34.90|-56.16|uruguay
Asunción|PY|America/Asuncion|-25.26|-57.58|paraguay,asuncion
São Paulo|BR|America/Sao_Paulo|-23.55|-46.63|brazil,sao paulo
Rio de Janeiro|BR|America/Sao_Paulo|-22.91|-43.17|rio
Brasília|BR|America/Sao_Paulo|-15.79|-47.88|brasilia
Manaus|BR|America/Manaus|-3.12|-60.02
Recife|BR|America/Recife|-8.05|-34.88
Georgetown|GY|America/Guyana|6.80|-58.16|guyana
Paramaribo|SR|America/Paramaribo|5.85|-55.20|suriname
Nuuk|GL|America/Nuuk|64.18|-51.72|greenland
Praia|CV|Atlantic/Cape_Verde|14.93|-23.51|cape verde
`;

export const CITIES = RAW.trim().split('\n').map(l => {
  const [name, cc, tz, lat, lon, al] = l.split('|');
  return { name, cc, tz, lat: +lat, lon: +lon, al: al ? al.split(',') : [] };
});

// Older engines know some zones only by their previous names.
const TZ_FALLBACK = { 'Europe/Kyiv': 'Europe/Kiev', 'Asia/Kolkata': 'Asia/Calcutta', 'Asia/Ho_Chi_Minh': 'Asia/Saigon', 'Asia/Yangon': 'Asia/Rangoon', 'Asia/Kathmandu': 'Asia/Katmandu', 'America/Nuuk': 'America/Godthab', 'Pacific/Kanton': 'Pacific/Enderbury' };
const tzOk = new Map();
export function safeZone(tz) {
  if (tzOk.has(tz)) return tzOk.get(tz);
  let z = tz;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { z = TZ_FALLBACK[tz] || 'UTC'; }
  tzOk.set(tz, z);
  return z;
}

export const COUNTRY_CURRENCY = Object.fromEntries(`AD EUR AE AED AF AFN AL ALL AM AMD AO AOA AR ARS AS USD AT EUR AU AUD AZ AZN BA BAM BD BDT BE EUR BG EUR BH BHD BM BMD BO BOB BR BRL BS BSD BT BTN BW BWP BY BYN CA CAD CD CDF CH CHF CI XOF CL CLP CM XAF CN CNY CO COP CR CRC CU CUP CV CVE CY EUR CZ CZK DE EUR DJ DJF DK DKK DO DOP DZ DZD EC USD EE EUR EG EGP ES EUR ET ETB FI EUR FJ FJD FR EUR GA XAF GB GBP GE GEL GF EUR GH GHS GL DKK GP EUR GR EUR GT GTQ GU USD GY GYD HK HKD HN HNL HR EUR HT HTG HU HUF ID IDR IE EUR IL ILS IN INR IQ IQD IR IRR IS ISK IT EUR JM JMD JO JOD JP JPY KE KES KG KGS KH KHR KI AUD KP KPW KR KRW KW KWD KZ KZT LA LAK LB LBP LK LKR LT EUR LU EUR LV EUR LY LYD MA MAD MC EUR MD MDL ME EUR MG MGA MK MKD ML XOF MM MMK MN MNT MO MOP MQ EUR MR MRU MT EUR MU MUR MV MVR MX MXN MY MYR MZ MZN NA NAD NC XPF NG NGN NI NIO NL EUR NO NOK NP NPR NZ NZD OM OMR PA PAB PE PEN PF XPF PG PGK PH PHP PK PKR PL PLN PR USD PS ILS PT EUR PY PYG QA QAR RE EUR RO RON RS RSD RU RUB RW RWF SA SAR SD SDG SE SEK SG SGD SI EUR SK EUR SN XOF SO SOS SR SRD SV USD SY SYP TH THB TJ TJS TM TMT TN TND TO TOP TR TRY TT TTD TW TWD TZ TZS UA UAH UG UGX US USD UY UYU UZ UZS VE VES VN VND WS WST YE YER ZA ZAR ZM ZMW ZW ZWG`
  .split(' ').reduce((a, v, i, arr) => (i % 2 ? a : a.concat([[v, arr[i + 1]]])), []));

/** Country (ISO alpha-2) for a time zone, from the city table. */
export function countryOfZone(tz) {
  const c = CITIES.find(c => c.tz === tz);
  if (c) return c.cc;
  const m = { 'Europe/Belfast': 'GB', 'Europe/Jersey': 'GB', 'Europe/Guernsey': 'GB', 'Europe/Isle_of_Man': 'GB', 'Europe/Gibraltar': 'GI', 'Europe/Busingen': 'DE', 'Europe/Vatican': 'VA', 'Europe/San_Marino': 'SM', 'Africa/Ceuta': 'ES', 'Africa/El_Aaiun': 'MA', 'Asia/Calcutta': 'IN', 'Europe/Kiev': 'UA', 'Asia/Saigon': 'VN' }[tz];
  if (m) return m;
  if (/^America\/(Indiana|Kentucky|North_Dakota)/.test(tz) || /^America\/(Boise|Juneau|Sitka|Nome|Menominee|Adak|Yakutat|Metlakatla)$/.test(tz)) return 'US';
  if (/^Australia\//.test(tz)) return 'AU';
  if (/^America\/Argentina\//.test(tz)) return 'AR';
  if (/^Asia\/(Chita|Tomsk|Barnaul|Novokuznetsk|Khandyga|Ust-Nera|Sakhalin|Srednekolymsk|Anadyr)$/.test(tz)) return 'RU';
  return null;
}

/** 🇫🇷 from "FR" */
export function flag(cc) {
  if (!cc || !/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let regionNames;
export function countryName(cc, locale) {
  try { regionNames ||= new Intl.DisplayNames([locale || 'en'], { type: 'region' }); return regionNames.of(cc) || cc; } catch { return cc; }
}
