// Every tool: id, category, name, tile glyph, module, short description, search keywords.
import { CATEGORIES } from '../data/units.js';
import { settings } from '../core/store.js';
import { currencySymbol } from '../core/num.js';

export const CATS = [
  { id: 'units', name: 'Units' },
  { id: 'money', name: 'Money' },
  { id: 'time', name: 'Date & time' },
  { id: 'math', name: 'Math' },
  { id: 'health', name: 'Health & fitness' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'home', name: 'Home' },
  { id: 'sizes', name: 'Sizes' },
  { id: 'tech', name: 'Tech' },
  { id: 'phone', name: 'Phone sensors' },
];

const cur = () => { const s = currencySymbol(settings.currency); return s.length <= 2 ? s : '¤'; };
const isoWeek = () => {
  const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
};

// [id, cat, name, glyph, module, description, keywords, unitCategory]
const T = [
  ['length', 'units', 'Length', 'm', 'units', '', 'distance height width depth metric imperial', 'length'],
  ['mass', 'units', 'Weight', 'kg', 'units', '', 'mass weight body weight', 'mass'],
  ['temperature', 'units', 'Temperature', '°C', 'units', '', 'temp weather fever degrees', 'temperature'],
  ['volume', 'units', 'Volume', 'L', 'units', '', 'capacity liquid', 'volume'],
  ['area', 'units', 'Area', 'm²', 'units', '', 'surface land square', 'area'],
  ['speed', 'units', 'Speed', 'km/h', 'units', '', 'velocity pace', 'speed'],
  ['time', 'units', 'Time units', 'h', 'units', '', 'duration seconds minutes hours days weeks months years', 'time'],
  ['pressure', 'units', 'Pressure', 'bar', 'units', '', 'tyre tire blood pressure', 'pressure'],
  ['energy', 'units', 'Energy', 'kJ', 'units', '', 'calories work heat', 'energy'],
  ['power', 'units', 'Power', 'kW', 'units', '', 'horsepower watts engine', 'power'],
  ['force', 'units', 'Force', 'N', 'units', '', 'weight force thrust', 'force'],
  ['torque', 'units', 'Torque', 'N·m', 'units', '', 'wrench bolt engine torque', 'torque'],
  ['angle', 'units', 'Angle', '°', 'units', '', 'degrees radians slope gps coordinates', 'angle'],
  ['frequency', 'units', 'Frequency', 'Hz', 'units', '', 'rpm cycles', 'frequency'],
  ['fuel', 'units', 'Fuel economy', 'mpg', 'units', '', 'consumption gas mileage petrol diesel', 'fuel'],
  ['ev', 'units', 'EV efficiency', 'kWh', 'units', '', 'electric car consumption tesla', 'ev'],
  ['density', 'units', 'Density', 'ρ', 'units', '', 'specific gravity mass volume', 'density'],
  ['flow', 'units', 'Flow rate', 'L/s', 'units', '', 'pump water flow', 'flow'],
  ['acceleration', 'units', 'Acceleration', 'g', 'units', '', 'g-force gravity', 'acceleration'],
  ['light', 'units', 'Illuminance', 'lx', 'units', '', 'lux light brightness', 'light'],

  ['currency', 'money', 'Currency', () => (cur() === '$' || cur() === '¤' ? '€$' : cur() + '$'), 'money', 'Live exchange rates, 150+ currencies', 'exchange rate forex fx money convert dollar euro pound dirham yen'],
  ['fxhistory', 'money', 'Exchange history', 'FX', 'money', 'Rate on any date, charts', 'historical exchange rate chart past date expense report'],
  ['cheatsheet', 'money', 'Price cheat sheet', '≈', 'money', 'Quick price table for travel', 'travel holiday prices abroad table'],
  ['crypto', 'money', 'Crypto & gold', '₿', 'money', 'Bitcoin, Ether, gold & silver prices', 'bitcoin btc ethereum eth crypto gold silver platinum precious metals carat'],
  ['zakat', 'money', 'Zakat', '2.5%', 'money', 'With today’s gold and silver prices', 'zakat nisab hawl islam gold silver'],
  ['tip', 'money', 'Tip & split', 'Tip', 'money', 'Tip, total and split the bill', 'tip gratuity split bill restaurant pourboire'],
  ['discount', 'money', 'Discount', '−%', 'money', 'Sale price, % off, original price', 'sale off reduction promo soldes'],
  ['vat', 'money', 'VAT & sales tax', 'VAT', 'money', 'Add or remove VAT / sales tax', 'tax tva gst sales tax ht ttc net gross'],
  ['margin', 'money', 'Margin & markup', 'M%', 'money', 'Profit margin and markup', 'profit markup margin cost price business'],
  ['loan', 'money', 'Loan & mortgage', 'Loan', 'money', 'Payments, interest, amortization', 'mortgage credit loan emprunt pret amortization interest monthly payment'],
  ['savings', 'money', 'Savings & interest', '+%', 'money', 'Compound interest, monthly deposits', 'compound interest savings investment inflation'],
  ['salary', 'money', 'Salary', () => `${cur()}/h`, 'units', 'Hourly ↔ monthly ↔ yearly', 'wage pay income hourly annual salaire', 'salary'],
  ['unitprice', 'money', 'Unit price', () => `${cur()}/kg`, 'money', 'Which pack is cheaper?', 'compare price per kg per liter supermarket grocery'],
  ['tripcost', 'money', 'Trip cost', 'Trip', 'money', 'Fuel or charging cost of a trip', 'fuel cost petrol gas trip road car split'],
  ['energycost', 'money', 'Energy cost', 'Plug', 'money', 'What an appliance costs to run', 'electricity cost appliance kwh bill watts'],

  ['datediff', 'time', 'Date difference', 'Δd', 'time', 'Days, weeks, working days between dates', 'days between dates duration working days business days how many days'],
  ['dateadd', 'time', 'Add to date', '+d', 'time', 'Date ± days, weeks, months, working days', 'add days subtract date plus deadline due'],
  ['age', 'time', 'Age', 'Age', 'time', 'Exact age, next birthday', 'birthday age born years old'],
  ['countdown', 'time', 'Countdowns', 'T−', 'time', 'Days until your events', 'countdown days until christmas event birthday holiday'],
  ['holidays', 'time', 'Holidays', 'Off', 'holidays', 'Public & school holidays, long weekends', 'public holidays bank holidays jours feries ponts bridge school holidays vacances scolaires zone a b c'],
  ['timezones', 'time', 'Time zones', 'UTC', 'time', 'World clock & meeting planner', 'world clock timezone time zone meeting gmt utc'],
  ['timecalc', 'time', 'Time calculator', 'h:m', 'time', 'Add durations, time between two times', 'hours minutes add time duration between'],
  ['timesheet', 'time', 'Timesheet', 'Σh', 'time', 'Hours worked per week, pay', 'hours worked work time card timesheet overtime'],
  ['travel', 'time', 'Travel time', 'ETA', 'time', 'Speed, distance, time & arrival', 'speed distance time eta arrival drive'],
  ['citydist', 'time', 'City distance', 'A↔B', 'travel', 'Distance & flight time between cities', 'distance between cities flight time km miles as the crow flies great circle'],
  ['unix', 'time', 'Unix time', 'Unix', 'time', 'Epoch timestamp ↔ date', 'epoch timestamp unix posix iso 8601'],
  ['dateinfo', 'time', 'Date info', () => 'W' + isoWeek(), 'time', 'Week number, day of year, moon phase', 'week number iso week day of year leap year weekday moon'],
  ['calendars', 'time', 'Calendars', 'Cal', 'time', 'Hijri, Hebrew, Persian, Chinese…', 'hijri islamic ramadan hebrew jewish persian chinese buddhist japanese calendar convert'],
  ['sun', 'time', 'Sun & moon', '☼', 'time', 'Sunrise, sunset, golden hour, moon', 'sunrise sunset daylight golden hour twilight moon phase'],

  ['percentage', 'math', 'Percentage', '%', 'math', '% of, % change, increase, decrease', 'percent percentage pourcentage'],
  ['scicalc', 'math', 'Scientific calculator', 'f(x)', 'calc', 'Big keys, functions, history', 'calculator calculatrice scientific sin cos tan log exponent factorial'],
  ['ratio', 'math', 'Ratio & rule of 3', 'a:b', 'math', 'Proportions, cross-multiplication', 'proportion rule of three regle de trois cross multiply'],
  ['fractions', 'math', 'Fractions', '½', 'math', 'Simplify, convert, calculate', 'fraction decimal simplify'],
  ['bases', 'math', 'Number bases', '0x', 'math', 'Binary, octal, decimal, hex', 'binary hex hexadecimal octal base'],
  ['roman', 'math', 'Roman numerals', 'XIV', 'math', 'Roman numerals ↔ numbers', 'roman numerals'],
  ['stats', 'math', 'Statistics', 'x̄', 'math', 'Mean, median, standard deviation…', 'average mean median mode standard deviation sum'],
  ['aspect', 'math', 'Aspect ratio', '16:9', 'math', 'Resize keeping proportions', 'aspect ratio resize image video proportion'],
  ['shapes', 'math', 'Area & volume', 'πr²', 'math', 'Shapes: area, perimeter, volume', 'geometry circle rectangle triangle sphere cylinder pool aquarium'],
  ['numbers', 'math', 'Big numbers', '10⁶', 'units', 'Million, billion, milliard, lakh…', 'million billion milliard trillion lakh crore scale', 'numbers'],
  ['words', 'math', 'Numbers in words', 'Abc', 'math', 'Write numbers & amounts (EN/FR)', 'number to words cheque check spell en lettres'],
  ['random', 'math', 'Random', '⚄', 'math', 'Numbers, dice, coin, list picker', 'random dice coin flip picker shuffle lottery'],

  ['bmi', 'health', 'BMI', 'BMI', 'health', 'Body mass index & healthy weight', 'bmi body mass index healthy weight imc'],
  ['calories', 'health', 'Calories', 'kcal', 'health', 'BMR & daily calorie needs', 'bmr tdee calories diet maintenance'],
  ['bodyfat', 'health', 'Body fat', 'BF%', 'health', 'US Navy body-fat estimate', 'body fat percentage'],
  ['pace', 'health', 'Running pace', '/km', 'time', 'Pace, splits, race times', 'running pace marathon 5k 10k half splits'],
  ['hrzones', 'health', 'Heart-rate zones', 'bpm', 'health', 'Training zones from age', 'heart rate zones max hr cardio'],
  ['duedate', 'health', 'Due date', '40w', 'health', 'Pregnancy due date & week', 'pregnancy due date weeks trimester'],
  ['blood', 'health', 'Blood values', 'mmol', 'units', 'Glucose, HbA1c, cholesterol units', 'glucose sugar hba1c cholesterol diabetes mmol mg/dl', 'blood'],
  ['sleep', 'health', 'Sleep cycles', 'Zz', 'health', 'Best bedtime & wake-up times', 'sleep bedtime wake up cycles'],

  ['cooking', 'kitchen', 'Cups ↔ grams', 'cup', 'kitchen', 'Volume ↔ weight for 40 ingredients', 'cups grams flour sugar butter baking tablespoon teaspoon recipe'],
  ['recipe', 'kitchen', 'Recipe scaler', '×2', 'kitchen', 'Scale servings or pan size', 'recipe scale servings portions double halve pan'],
  ['grains', 'kitchen', 'Rice & pasta', 'Rice', 'kitchen', 'Portions, water and cooking time', 'rice pasta couscous quinoa bulgur lentils portion water ratio cooking time riz pates'],
  ['oven', 'kitchen', 'Oven temperature', '180°', 'units', '°C, °F, fan, gas mark, thermostat', 'oven gas mark fan thermostat baking', 'oven'],
  ['coffee', 'kitchen', 'Coffee ratio', '1:16', 'kitchen', 'Coffee-to-water brew ratio', 'coffee brew ratio pour over french press espresso'],
  ['heating', 'home', 'Heating & cooling', 'BTU', 'home', 'Heater and air-con power for a room', 'heater radiator air conditioning ac btu room chauffage climatisation puissance'],
  ['energyprices', 'home', 'Energy prices', () => `${cur()}/kWh`, 'home', 'Cheapest way to heat: cost per kWh', 'electricity gas heating oil fioul pellets granules firewood bois heat pump pac propane compare kwh'],

  ['shoes', 'sizes', 'Shoe sizes', '42', 'units', 'EU, UK, US, cm', 'shoe size pointure', 'shoes'],
  ['clothing', 'sizes', 'Clothing sizes', 'M', 'sizes', 'International clothing sizes', 'clothing size dress shirt jeans trousers taille'],
  ['rings', 'sizes', 'Ring sizes', '⌀', 'units', 'EU, US, UK, JP ring sizes', 'ring size bague', 'rings'],
  ['paper', 'sizes', 'Paper sizes', 'A4', 'sizes', 'A4, Letter, envelopes, photos', 'paper size a4 a3 letter envelope photo print'],
  ['screen', 'sizes', 'Screen & PPI', 'PPI', 'sizes', 'Pixel density and size', 'screen ppi dpi diagonal monitor tv resolution'],
  ['tires', 'sizes', 'Tire size', 'R17', 'sizes', 'Diameter, speedometer difference', 'tire tyre size wheel speedometer'],
  ['wire', 'sizes', 'Wire gauge', 'AWG', 'units', 'AWG ↔ mm² ↔ diameter', 'awg wire gauge cable section', 'wire'],

  ['data', 'tech', 'Data size', 'GB', 'units', '', 'storage bytes file size', 'data'],
  ['datarate', 'tech', 'Data speed', 'Mb/s', 'units', '', 'bandwidth internet speed mbps download', 'datarate'],
  ['download', 'tech', 'Download time', '↓GB', 'tech', 'How long will it take?', 'download upload time file size speed'],
  ['color', 'tech', 'Color', '#', 'tech', 'HEX, RGB, HSL, CMYK, contrast', 'colour color hex rgb hsl cmyk contrast'],
  ['qr', 'tech', 'QR code', 'QR', 'qrtool', 'Links, Wi-Fi, contacts as QR codes', 'qr code generator wifi link contact vcard sms email'],
  ['css', 'tech', 'CSS units', 'px', 'units', 'px, pt, em, rem, mm…', 'css px pt em rem typography font', 'css'],
  ['ohm', 'tech', "Ohm's law", 'Ω', 'tech', 'Volts, amps, ohms, watts', 'ohm volt amp watt resistance current voltage electricity'],
  ['battery', 'tech', 'Battery', 'mAh', 'tech', 'mAh ↔ Wh, runtime', 'battery mah wh power bank capacity runtime'],
  ['text', 'tech', 'Text counter', 'Aa', 'tech', 'Words, characters, reading time', 'word count character count text length'],
  ['level', 'phone', 'Spirit level', '0.0°', 'phone', 'Bubble level with the motion sensor', 'spirit level bubble niveau a bulle inclinometer tilt angle'],
  ['speedo', 'phone', 'Speedometer', 'GPS', 'phone', 'GPS speed, altitude, trip distance', 'speedometer gps speed altitude elevation trip compteur vitesse'],
];

export const TOOLS = T.map(([id, cat, name, glyph, mod, desc, kw, unitCat]) => {
  let d = desc;
  if (!d && unitCat) d = CATEGORIES[unitCat].units.filter(u => u.c).slice(0, 6).map(u => u.sym).join(', ') + '…';
  let words = kw || '';
  if (unitCat && CATEGORIES[unitCat].units) words += ' ' + CATEGORIES[unitCat].units.map(u => `${u.name} ${u.sym} ${u.al || ''}`).join(' ');
  return { id, cat, name, glyph, mod, desc: d, kw: words.toLowerCase(), unitCat };
});
const BY_ID = new Map(TOOLS.map(t => [t.id, t]));
export const toolById = id => BY_ID.get(id);
export const glyphOf = t => (typeof t.glyph === 'function' ? t.glyph() : t.glyph);
