// Unit definitions. Linear units have a factor `f` to the category base (f may depend on params `p`);
// others have to()/from(). Composite units (ft + in) have `parts`. Exact factors where they exist.
// Flags: c = common (shown by default), sys = m|us|uk|i (for defaults), al = search aliases.
const PI = Math.PI;
const clean = x => (Number.isFinite(x) ? Math.round(x * 1e10) / 1e10 : x);

function U(id, name, sym, f, o = {}) { return { id, name, sym, f, ...o }; }
const lin = (id, name, sym, f, o) => U(id, name, sym, f, o);

export const CATEGORIES = {
  length: {
    name: 'Length', base: 'm', units: [
      lin('mm', 'Millimeter', 'mm', 1e-3, { c: 1, sys: 'm' }),
      lin('cm', 'Centimeter', 'cm', 1e-2, { c: 1, sys: 'm', al: 'cms' }),
      lin('m', 'Meter', 'm', 1, { c: 1, sys: 'm', al: 'mtr mtrs' }),
      lin('km', 'Kilometer', 'km', 1e3, { c: 1, sys: 'm', al: 'kms klick klicks kilometre' }),
      lin('in', 'Inch', 'in', 0.0254, { c: 1, sys: 'i', al: 'inches " ″ pouce pouces', frac: 1 }),
      lin('ft', 'Foot', 'ft', 0.3048, { c: 1, sys: 'i', al: "feet ' ′ pied pieds" }),
      U('ftin', 'Feet + inches', 'ft + in', null, { c: 1, sys: 'i', parts: [{ sym: 'ft', f: 0.3048 }, { sym: 'in', f: 0.0254 }], dec: 2, al: 'height' }),
      lin('yd', 'Yard', 'yd', 0.9144, { c: 1, sys: 'i', al: 'yards yds' }),
      lin('mi', 'Mile', 'mi', 1609.344, { c: 1, sys: 'i', al: 'miles' }),
      lin('nmi', 'Nautical mile', 'nmi', 1852, { al: 'nautical miles NM' }),
      lin('nm', 'Nanometer', 'nm', 1e-9),
      lin('um', 'Micrometer', 'µm', 1e-6, { al: 'micron microns um' }),
      lin('dm', 'Decimeter', 'dm', 0.1),
      lin('thou', 'Thou (mil)', 'mil', 2.54e-5, { al: 'thou thousandth' }),
      lin('hand', 'Hand', 'hh', 0.1016, { al: 'hands' }),
      lin('fathom', 'Fathom', 'ftm', 1.8288, { al: 'fathoms' }),
      lin('rod', 'Rod', 'rd', 5.0292, { al: 'rods pole perch' }),
      lin('chain', 'Chain', 'ch', 20.1168, { al: 'chains' }),
      lin('furlong', 'Furlong', 'fur', 201.168, { al: 'furlongs' }),
      lin('league', 'League', 'lea', 4828.032, { al: 'leagues' }),
      lin('smil', 'Scandinavian mile', 'mil (SE/NO)', 1e4, { al: 'mil scandinavian' }),
      lin('ang', 'Ångström', 'Å', 1e-10, { al: 'angstrom angstroms' }),
      lin('au', 'Astronomical unit', 'au', 149597870700, { al: 'astronomical units' }),
      lin('ly', 'Light-year', 'ly', 9460730472580800, { al: 'light years lightyear lightyears' }),
      lin('pc', 'Parsec', 'pc', 3.0856775814913673e16, { al: 'parsecs' }),
    ],
  },
  mass: {
    name: 'Weight', base: 'kg', units: [
      lin('mg', 'Milligram', 'mg', 1e-6, { c: 1, sys: 'm' }),
      lin('g', 'Gram', 'g', 1e-3, { c: 1, sys: 'm', al: 'gr grams gramme grammes gm gms' }),
      lin('kg', 'Kilogram', 'kg', 1, { c: 1, sys: 'm', al: 'kilo kilos kgs' }),
      lin('t', 'Tonne', 't', 1000, { c: 1, sys: 'm', al: 'tonnes metric ton metric tons' }),
      lin('oz', 'Ounce', 'oz', 0.028349523125, { c: 1, sys: 'i', al: 'ounces' }),
      lin('lb', 'Pound', 'lb', 0.45359237, { c: 1, sys: 'i', al: 'lbs pounds livre' }),
      U('lboz', 'Pounds + ounces', 'lb + oz', null, { c: 1, sys: 'i', parts: [{ sym: 'lb', f: 0.45359237 }, { sym: 'oz', f: 0.028349523125 }], dec: 1 }),
      U('stlb', 'Stone + pounds', 'st + lb', null, { c: 1, sys: 'uk', parts: [{ sym: 'st', f: 6.35029318 }, { sym: 'lb', f: 0.45359237 }], dec: 1 }),
      lin('st', 'Stone', 'st', 6.35029318, { sys: 'uk', al: 'stones' }),
      lin('ug', 'Microgram', 'µg', 1e-9, { al: 'mcg ug' }),
      lin('tonus', 'Short ton (US)', 'ton (US)', 907.18474, { al: 'short ton us ton' }),
      lin('tonuk', 'Long ton (UK)', 'ton (UK)', 1016.0469088, { al: 'long ton imperial ton' }),
      lin('ct', 'Carat', 'ct', 0.0002, { al: 'carats karat' }),
      lin('grain', 'Grain', 'gr', 6.479891e-5, { al: 'grains' }),
      lin('ozt', 'Troy ounce', 'oz t', 0.0311034768, { al: 'troy ounces troy oz ozt' }),
      lin('dwt', 'Pennyweight', 'dwt', 0.00155517384),
      lin('tola', 'Tola', 'tola', 0.0116638038, { al: 'tolas' }),
      lin('q', 'Quintal', 'q', 100, { al: 'quintals' }),
      lin('slug', 'Slug', 'slug', 14.59390294),
    ],
  },
  temperature: {
    name: 'Temperature', base: 'K', negative: true, units: [
      U('C', 'Celsius', '°C', null, { c: 1, sys: 'm', to: x => clean(x + 273.15), from: k => clean(k - 273.15), al: 'c celsius centigrade degc ºc deg c degrees c' }),
      U('F', 'Fahrenheit', '°F', null, { c: 1, sys: 'i', to: x => clean((x + 459.67) * 5 / 9), from: k => clean(k * 9 / 5 - 459.67), al: 'f fahrenheit degf ºf deg f degrees f' }),
      U('K', 'Kelvin', 'K', null, { c: 1, to: x => x, from: k => k, al: 'k kelvin kelvins' }),
      U('R', 'Rankine', '°R', null, { to: x => clean(x * 5 / 9), from: k => clean(k * 9 / 5), al: 'rankine' }),
      U('Re', 'Réaumur', '°Ré', null, { to: x => clean(x * 1.25 + 273.15), from: k => clean((k - 273.15) * 0.8), al: 'reaumur' }),
    ],
  },
  volume: {
    name: 'Volume', base: 'L', units: [
      lin('ml', 'Milliliter', 'mL', 0.001, { c: 1, sys: 'm', al: 'ml cc cm3 cm³ millilitre' }),
      lin('l', 'Liter', 'L', 1, { c: 1, sys: 'm', al: 'l litre litres liters ltr' }),
      lin('m3', 'Cubic meter', 'm³', 1000, { c: 1, sys: 'm', al: 'm3 cubic meters cubic metre stere' }),
      lin('tsp', 'Teaspoon (US)', 'tsp', 0.00492892159375, { c: 1, sys: 'us', al: 'teaspoon teaspoons' }),
      lin('tbsp', 'Tablespoon (US)', 'tbsp', 0.01478676478125, { c: 1, sys: 'us', al: 'tablespoon tablespoons tbs tbl' }),
      lin('floz', 'Fluid ounce (US)', 'fl oz', 0.0295735295625, { c: 1, sys: 'us', al: 'fl oz floz fluid ounce fluid ounces oz' }),
      lin('cup', 'Cup (US)', 'cup', 0.2365882365, { c: 1, sys: 'us', al: 'cups' }),
      lin('pt', 'Pint (US)', 'pt', 0.473176473, { c: 1, sys: 'us', al: 'pint pints' }),
      lin('qt', 'Quart (US)', 'qt', 0.946352946, { sys: 'us', al: 'quart quarts' }),
      lin('gal', 'Gallon (US)', 'gal', 3.785411784, { c: 1, sys: 'us', al: 'gallon gallons' }),
      lin('ptuk', 'Pint (UK)', 'pt (UK)', 0.56826125, { c: 1, sys: 'uk', al: 'imperial pint uk pint' }),
      lin('galuk', 'Gallon (UK)', 'gal (UK)', 4.54609, { c: 1, sys: 'uk', al: 'imperial gallon uk gallon' }),
      lin('cl', 'Centiliter', 'cL', 0.01, { al: 'cl centilitre' }),
      lin('dl', 'Deciliter', 'dL', 0.1, { al: 'dl decilitre' }),
      lin('flozuk', 'Fluid ounce (UK)', 'fl oz (UK)', 0.0284130625, { sys: 'uk', al: 'imperial fluid ounce' }),
      lin('qtuk', 'Quart (UK)', 'qt (UK)', 1.1365225, { sys: 'uk' }),
      lin('tspm', 'Teaspoon (metric)', 'tsp (5 mL)', 0.005, { al: 'metric teaspoon' }),
      lin('tbspm', 'Tablespoon (metric)', 'tbsp (15 mL)', 0.015, { al: 'metric tablespoon' }),
      lin('cupm', 'Cup (metric)', 'cup (250 mL)', 0.25, { al: 'metric cup' }),
      lin('mm3', 'Cubic millimeter', 'mm³', 1e-6, { al: 'mm3' }),
      lin('in3', 'Cubic inch', 'in³', 0.016387064, { al: 'in3 cubic inches cu in' }),
      lin('ft3', 'Cubic foot', 'ft³', 28.316846592, { al: 'ft3 cubic feet cu ft' }),
      lin('yd3', 'Cubic yard', 'yd³', 764.554857984, { al: 'yd3 cubic yards' }),
      lin('bbl', 'Barrel (oil)', 'bbl', 158.987294928, { al: 'barrel barrels' }),
      lin('acft', 'Acre-foot', 'ac·ft', 1233481.83754752, { al: 'acre foot acre feet' }),
    ],
  },
  area: {
    name: 'Area', base: 'm²', units: [
      lin('cm2', 'Square centimeter', 'cm²', 1e-4, { c: 1, sys: 'm', al: 'cm2 sq cm' }),
      lin('m2', 'Square meter', 'm²', 1, { c: 1, sys: 'm', al: 'm2 sqm sq m square metre square meters' }),
      lin('ha', 'Hectare', 'ha', 1e4, { c: 1, sys: 'm', al: 'hectares' }),
      lin('km2', 'Square kilometer', 'km²', 1e6, { c: 1, sys: 'm', al: 'km2 sq km' }),
      lin('in2', 'Square inch', 'in²', 0.00064516, { c: 1, sys: 'i', al: 'in2 sq in square inches' }),
      lin('ft2', 'Square foot', 'ft²', 0.09290304, { c: 1, sys: 'i', al: 'ft2 sq ft sqft square feet' }),
      lin('yd2', 'Square yard', 'yd²', 0.83612736, { c: 1, sys: 'i', al: 'yd2 sq yd square yards' }),
      lin('ac', 'Acre', 'ac', 4046.8564224, { c: 1, sys: 'i', al: 'acre acres' }),
      lin('mi2', 'Square mile', 'mi²', 2589988.110336, { c: 1, sys: 'i', al: 'mi2 sq mi square miles' }),
      lin('mm2', 'Square millimeter', 'mm²', 1e-6, { al: 'mm2 sq mm' }),
      lin('a', 'Are', 'a', 100, { al: 'are ares' }),
      lin('dunam', 'Dunam', 'dunam', 1000, { al: 'dunams donum' }),
      lin('feddan', 'Feddan', 'feddan', 4200.833, { al: 'feddans' }),
      lin('tsubo', 'Tsubo / pyeong', 'tsubo', 400 / 121, { al: 'pyeong' }),
    ],
  },
  speed: {
    name: 'Speed', base: 'm/s', units: [
      lin('kmh', 'Kilometers per hour', 'km/h', 1 / 3.6, { c: 1, sys: 'm', al: 'kph kmph kmh km/hr' }),
      lin('mph', 'Miles per hour', 'mph', 0.44704, { c: 1, sys: 'i', al: 'mi/h miles per hour' }),
      lin('ms', 'Meters per second', 'm/s', 1, { c: 1, al: 'mps meters per second' }),
      lin('kn', 'Knot', 'kn', 1852 / 3600, { c: 1, al: 'knot knots kt kts' }),
      lin('fts', 'Feet per second', 'ft/s', 0.3048, { c: 1, al: 'fps feet per second' }),
      U('minkm', 'Pace per km', 'min/km', null, { c: 1, sys: 'm', parts: [{ sym: 'min', f: 60 }, { sym: 's', f: 1 }], dec: 0, to: s => (s > 0 ? 1000 / s : NaN), from: v => (v > 0 ? 1000 / v : NaN), al: 'pace min/km' }),
      U('minmi', 'Pace per mile', 'min/mi', null, { c: 1, sys: 'i', parts: [{ sym: 'min', f: 60 }, { sym: 's', f: 1 }], dec: 0, to: s => (s > 0 ? 1609.344 / s : NaN), from: v => (v > 0 ? 1609.344 / v : NaN), al: 'min/mi min/mile' }),
      lin('mach', 'Mach (sea level)', 'Mach', 340.29, { al: 'mach' }),
      lin('c', 'Speed of light', 'c', 299792458, { al: 'light speed' }),
    ],
  },
  time: {
    name: 'Time', base: 's', units: [
      lin('ms', 'Millisecond', 'ms', 1e-3, { c: 1, al: 'millisecond milliseconds msec' }),
      lin('s', 'Second', 's', 1, { c: 1, al: 'sec secs second seconds' }),
      lin('min', 'Minute', 'min', 60, { c: 1, al: 'mins minute minutes' }),
      lin('h', 'Hour', 'h', 3600, { c: 1, al: 'hr hrs hour hours heure heures' }),
      lin('d', 'Day', 'd', 86400, { c: 1, al: 'day days jour jours' }),
      lin('wk', 'Week', 'wk', 604800, { c: 1, al: 'week weeks semaine semaines' }),
      lin('mo', 'Month (average)', 'mo', 2629746, { c: 1, al: 'month months mois' }),
      lin('yr', 'Year (average)', 'yr', 31556952, { c: 1, al: 'year years an ans annee annees' }),
      U('hms', 'Hours + min + s', 'h:m:s', null, { c: 1, parts: [{ sym: 'h', f: 3600 }, { sym: 'min', f: 60 }, { sym: 's', f: 1 }], dec: 0 }),
      U('dhm', 'Days + h + min', 'd h m', null, { parts: [{ sym: 'd', f: 86400 }, { sym: 'h', f: 3600 }, { sym: 'min', f: 60 }], dec: 0 }),
      lin('ns', 'Nanosecond', 'ns', 1e-9, { al: 'nanoseconds' }),
      lin('us', 'Microsecond', 'µs', 1e-6, { al: 'microseconds us' }),
      lin('fortnight', 'Fortnight', 'fortnight', 1209600, { al: 'fortnights' }),
      lin('yr365', 'Year (365 days)', 'yr (365 d)', 31536000),
      lin('decade', 'Decade', 'decade', 315569520, { al: 'decades' }),
      lin('century', 'Century', 'century', 3155695200, { al: 'centuries' }),
      lin('millennium', 'Millennium', 'millennium', 31556952000, { al: 'millennia' }),
    ],
  },
  pressure: {
    name: 'Pressure', base: 'Pa', units: [
      lin('pa', 'Pascal', 'Pa', 1, { c: 1, al: 'pa pascal pascals' }),
      lin('hpa', 'Hectopascal / millibar', 'hPa', 100, { c: 1, al: 'hpa mbar millibar millibars' }),
      lin('kpa', 'Kilopascal', 'kPa', 1000, { c: 1, al: 'kpa' }),
      lin('bar', 'Bar', 'bar', 1e5, { c: 1, al: 'bars' }),
      lin('psi', 'Pound per square inch', 'psi', 6894.757293168, { c: 1, al: 'lb/in2 lbf/in2' }),
      lin('atm', 'Atmosphere', 'atm', 101325, { c: 1, al: 'atmosphere atmospheres' }),
      lin('mmhg', 'Millimeter of mercury', 'mmHg', 133.322387415, { c: 1, al: 'mmhg' }),
      lin('mpa', 'Megapascal', 'MPa', 1e6, { al: 'mpa' }),
      lin('inhg', 'Inch of mercury', 'inHg', 3386.389, { al: 'inhg' }),
      lin('torr', 'Torr', 'Torr', 101325 / 760, { al: 'torr' }),
      lin('kgcm2', 'Kilogram-force per cm²', 'kgf/cm²', 98066.5, { al: 'kgf/cm2 kg/cm2 at' }),
      lin('cmh2o', 'Centimeter of water', 'cmH₂O', 98.0665, { al: 'cmh2o' }),
      lin('inh2o', 'Inch of water', 'inH₂O', 249.08891, { al: 'inh2o' }),
      lin('ksi', 'Kilopound per square inch', 'ksi', 6894757.293168, { al: 'ksi' }),
    ],
  },
  energy: {
    name: 'Energy', base: 'J', units: [
      lin('j', 'Joule', 'J', 1, { c: 1, al: 'j joule joules' }),
      lin('kj', 'Kilojoule', 'kJ', 1e3, { c: 1, al: 'kj kilojoules' }),
      lin('cal', 'Calorie', 'cal', 4.184, { c: 1, al: 'calorie small calorie' }),
      lin('kcal', 'Kilocalorie (food Calorie)', 'kcal', 4184, { c: 1, al: 'kcal calories Cal food calorie kilocalorie' }),
      lin('wh', 'Watt-hour', 'Wh', 3600, { c: 1, al: 'wh watt hour' }),
      lin('kwh', 'Kilowatt-hour', 'kWh', 3.6e6, { c: 1, al: 'kwh kilowatt hour' }),
      lin('btu', 'British thermal unit', 'BTU', 1055.05585262, { c: 1, al: 'btu btus' }),
      lin('mj', 'Megajoule', 'MJ', 1e6, { al: 'mj' }),
      lin('gj', 'Gigajoule', 'GJ', 1e9, { al: 'gj' }),
      lin('mwh', 'Megawatt-hour', 'MWh', 3.6e9, { al: 'mwh' }),
      lin('therm', 'Therm (US)', 'thm', 105480400, { al: 'therm therms' }),
      lin('ev', 'Electronvolt', 'eV', 1.602176634e-19, { al: 'ev electronvolt' }),
      lin('ftlbf', 'Foot-pound', 'ft·lbf', 1.3558179483314004, { al: 'ft-lb ftlb foot pound' }),
      lin('erg', 'Erg', 'erg', 1e-7),
      lin('ttnt', 'Ton of TNT', 't TNT', 4.184e9, { al: 'tnt' }),
      lin('toe', 'Tonne of oil equivalent', 'toe', 4.1868e10, { al: 'toe' }),
    ],
  },
  power: {
    name: 'Power', base: 'W', units: [
      lin('w', 'Watt', 'W', 1, { c: 1, al: 'w watt watts' }),
      lin('kw', 'Kilowatt', 'kW', 1e3, { c: 1, al: 'kw kilowatts' }),
      lin('mw', 'Megawatt', 'MW', 1e6, { c: 1, al: 'megawatt' }),
      lin('hp', 'Horsepower (mechanical)', 'hp', 745.69987158227022, { c: 1, al: 'hp horsepower bhp' }),
      lin('ps', 'Metric horsepower (PS, CV, ch)', 'PS', 735.49875, { c: 1, al: 'ps cv ch pferdestarke metric hp' }),
      lin('btuh', 'BTU per hour', 'BTU/h', 0.29307107017, { c: 1, al: 'btu/h btuh' }),
      lin('mwatt', 'Milliwatt', 'mW', 1e-3, { al: 'milliwatt' }),
      lin('gw', 'Gigawatt', 'GW', 1e9, { al: 'gw' }),
      lin('kcalh', 'Kilocalorie per hour', 'kcal/h', 1.163, { al: 'kcal/h' }),
      lin('tr', 'Ton of refrigeration', 'TR', 3516.8528420667, { al: 'refrigeration ton' }),
      lin('ftlbfs', 'Foot-pound per second', 'ft·lbf/s', 1.3558179483314004),
    ],
  },
  force: {
    name: 'Force', base: 'N', units: [
      lin('n', 'Newton', 'N', 1, { c: 1, al: 'n newton newtons' }),
      lin('kn', 'Kilonewton', 'kN', 1e3, { c: 1, al: 'kn kilonewtons' }),
      lin('kgf', 'Kilogram-force', 'kgf', 9.80665, { c: 1, al: 'kgf kilopond kp' }),
      lin('lbf', 'Pound-force', 'lbf', 4.4482216152605, { c: 1, al: 'lbf' }),
      lin('dyn', 'Dyne', 'dyn', 1e-5, { al: 'dyne dynes' }),
      lin('ozf', 'Ounce-force', 'ozf', 0.27801385095378125),
      lin('pdl', 'Poundal', 'pdl', 0.138254954376),
      lin('tf', 'Tonne-force', 'tf', 9806.65),
    ],
  },
  torque: {
    name: 'Torque', base: 'N·m', units: [
      lin('nm', 'Newton-meter', 'N·m', 1, { c: 1, al: 'nm n.m newton meter' }),
      lin('kgfm', 'Kilogram-force meter', 'kgf·m', 9.80665, { c: 1, al: 'kgm kgf.m' }),
      lin('lbfft', 'Pound-force foot', 'lbf·ft', 1.3558179483314004, { c: 1, al: 'lb-ft lbft ft-lb ft lb' }),
      lin('lbfin', 'Pound-force inch', 'lbf·in', 0.1129848290276167, { c: 1, al: 'in-lb lbin' }),
      lin('ncm', 'Newton-centimeter', 'N·cm', 0.01),
      lin('knm', 'Kilonewton-meter', 'kN·m', 1e3),
      lin('kgfcm', 'Kilogram-force centimeter', 'kgf·cm', 0.0980665),
      lin('ozfin', 'Ounce-force inch', 'ozf·in', 0.00706155181422604),
    ],
  },
  angle: {
    name: 'Angle', base: 'rad', negative: true, units: [
      lin('deg', 'Degree', '°', PI / 180, { c: 1, al: 'deg degree degrees °' }),
      U('dms', 'Degrees + minutes + seconds', '° ′ ″', null, { c: 1, parts: [{ sym: '°', f: PI / 180 }, { sym: '′', f: PI / 10800 }, { sym: '″', f: PI / 648000 }], dec: 2 }),
      lin('rad', 'Radian', 'rad', 1, { c: 1, al: 'rad radian radians' }),
      lin('grad', 'Gradian', 'gon', PI / 200, { c: 1, al: 'grad gradian gon grade' }),
      lin('turn', 'Turn', 'turn', 2 * PI, { c: 1, al: 'turn turns revolution revolutions rev' }),
      U('slope', 'Slope (grade)', '%', null, { c: 1, to: p => Math.atan(p / 100), from: r => Math.tan(r) * 100, al: 'slope grade gradient' }),
      lin('arcmin', 'Arcminute', '′', PI / 10800, { al: 'arcmin arcminute arcminutes' }),
      lin('arcsec', 'Arcsecond', '″', PI / 648000, { al: 'arcsec arcsecond arcseconds' }),
      lin('mil', 'Mil (NATO)', 'mil', 2 * PI / 6400, { al: 'mils' }),
      lin('mrad', 'Milliradian', 'mrad', 1e-3, { al: 'mrad' }),
    ],
  },
  frequency: {
    name: 'Frequency', base: 'Hz', units: [
      lin('hz', 'Hertz', 'Hz', 1, { c: 1, al: 'hz hertz' }),
      lin('khz', 'Kilohertz', 'kHz', 1e3, { c: 1, al: 'khz' }),
      lin('mhz', 'Megahertz', 'MHz', 1e6, { c: 1, al: 'mhz' }),
      lin('ghz', 'Gigahertz', 'GHz', 1e9, { c: 1, al: 'ghz' }),
      lin('rpm', 'Revolutions per minute', 'rpm', 1 / 60, { c: 1, al: 'rpm tr/min' }),
      lin('bpm', 'Beats per minute', 'bpm', 1 / 60, { al: 'bpm' }),
      lin('rads', 'Radians per second', 'rad/s', 1 / (2 * PI), { al: 'rad/s' }),
      lin('thz', 'Terahertz', 'THz', 1e12, { al: 'thz' }),
      U('period', 'Period (milliseconds)', 'ms period', null, { to: ms => (ms > 0 ? 1000 / ms : NaN), from: f => (f > 0 ? 1000 / f : NaN) }),
    ],
  },
  fuel: {
    name: 'Fuel economy', base: 'L/100 km', units: [
      U('l100', 'Liters per 100 km', 'L/100 km', null, { c: 1, sys: 'm', to: x => x, from: b => b, al: 'l/100km l/100 km lp100km' }),
      U('kml', 'Kilometers per liter', 'km/L', null, { c: 1, to: x => (x > 0 ? 100 / x : NaN), from: b => (b > 0 ? 100 / b : NaN), al: 'km/l kmpl' }),
      U('mpg', 'Miles per gallon (US)', 'mpg (US)', null, { c: 1, sys: 'us', to: x => (x > 0 ? 235.2145833333 / x : NaN), from: b => (b > 0 ? 235.2145833333 / b : NaN), al: 'mpg us mpg' }),
      U('mpguk', 'Miles per gallon (UK)', 'mpg (UK)', null, { c: 1, sys: 'uk', to: x => (x > 0 ? 282.4809363320 / x : NaN), from: b => (b > 0 ? 282.4809363320 / b : NaN), al: 'uk mpg imperial mpg' }),
      U('lmi', 'Liters per mile', 'L/mi', null, { to: x => x * 100 / 1.609344, from: b => b * 1.609344 / 100 }),
      U('gal100mi', 'Gallons (US) per 100 mi', 'gal/100 mi', null, { to: x => x * 3.785411784 / 1.609344, from: b => b * 1.609344 / 3.785411784 }),
    ],
  },
  ev: {
    name: 'EV efficiency', base: 'kWh/100 km', units: [
      U('kwh100', 'kWh per 100 km', 'kWh/100 km', null, { c: 1, sys: 'm', to: x => x, from: b => b, al: 'kwh/100km' }),
      U('whkm', 'Wh per km', 'Wh/km', null, { c: 1, to: x => x / 10, from: b => b * 10, al: 'wh/km' }),
      U('kmkwh', 'km per kWh', 'km/kWh', null, { c: 1, to: x => (x > 0 ? 100 / x : NaN), from: b => (b > 0 ? 100 / b : NaN), al: 'km/kwh' }),
      U('mikwh', 'Miles per kWh', 'mi/kWh', null, { c: 1, sys: 'i', to: x => (x > 0 ? 100 / (x * 1.609344) : NaN), from: b => (b > 0 ? 100 / (b * 1.609344) : NaN), al: 'mi/kwh' }),
      U('whmi', 'Wh per mile', 'Wh/mi', null, { c: 1, to: x => x / 16.09344, from: b => b * 16.09344, al: 'wh/mi' }),
      U('kwh100mi', 'kWh per 100 mi', 'kWh/100 mi', null, { to: x => x / 1.609344, from: b => b * 1.609344 }),
      U('mpge', 'MPGe', 'MPGe', null, { to: x => (x > 0 ? 3370.5 / (x * 1.609344) : NaN), from: b => (b > 0 ? 3370.5 / (b * 1.609344) : NaN), al: 'mpge' }),
    ],
  },
  density: {
    name: 'Density', base: 'kg/m³', units: [
      lin('kgm3', 'Kilogram per cubic meter', 'kg/m³', 1, { c: 1, al: 'kg/m3' }),
      lin('gcm3', 'Gram per cubic centimeter', 'g/cm³', 1000, { c: 1, al: 'g/cm3 g/cc g/ml' }),
      lin('kgl', 'Kilogram per liter', 'kg/L', 1000, { c: 1, al: 'kg/l' }),
      lin('gl', 'Gram per liter', 'g/L', 1, { c: 1, al: 'g/l' }),
      lin('lbft3', 'Pound per cubic foot', 'lb/ft³', 16.018463373960138, { c: 1, al: 'lb/ft3 pcf' }),
      lin('lbin3', 'Pound per cubic inch', 'lb/in³', 27679.904710203125, { c: 1, al: 'lb/in3' }),
      lin('lbgal', 'Pound per gallon (US)', 'lb/gal', 119.82642731689663, { c: 1, al: 'lb/gal ppg' }),
      lin('mgl', 'Milligram per liter', 'mg/L', 0.001, { al: 'mg/l' }),
      lin('ozin3', 'Ounce per cubic inch', 'oz/in³', 1729.9940443877),
    ],
  },
  flow: {
    name: 'Flow rate', base: 'L/s', units: [
      lin('ls', 'Liters per second', 'L/s', 1, { c: 1, al: 'l/s lps' }),
      lin('lmin', 'Liters per minute', 'L/min', 1 / 60, { c: 1, al: 'l/min lpm' }),
      lin('lh', 'Liters per hour', 'L/h', 1 / 3600, { c: 1, al: 'l/h lph' }),
      lin('m3h', 'Cubic meters per hour', 'm³/h', 1000 / 3600, { c: 1, al: 'm3/h' }),
      lin('gpm', 'Gallons (US) per minute', 'gal/min', 3.785411784 / 60, { c: 1, al: 'gpm gal/min' }),
      lin('cfm', 'Cubic feet per minute', 'ft³/min', 28.316846592 / 60, { c: 1, al: 'cfm ft3/min' }),
      lin('m3s', 'Cubic meters per second', 'm³/s', 1000, { al: 'm3/s cumecs' }),
      lin('mlmin', 'Milliliters per minute', 'mL/min', 1 / 60000, { al: 'ml/min' }),
      lin('gph', 'Gallons (US) per hour', 'gal/h', 3.785411784 / 3600, { al: 'gph' }),
      lin('gpmuk', 'Gallons (UK) per minute', 'gal (UK)/min', 4.54609 / 60),
      lin('cfs', 'Cubic feet per second', 'ft³/s', 28.316846592, { al: 'cfs' }),
      lin('bpd', 'Barrels per day', 'bbl/d', 158.987294928 / 86400, { al: 'bpd' }),
    ],
  },
  acceleration: {
    name: 'Acceleration', base: 'm/s²', negative: true, units: [
      lin('ms2', 'Meters per second²', 'm/s²', 1, { c: 1, al: 'm/s2' }),
      lin('g0', 'Standard gravity', 'g', 9.80665, { c: 1, al: 'g-force gforce gee' }),
      lin('fts2', 'Feet per second²', 'ft/s²', 0.3048, { c: 1, al: 'ft/s2' }),
      lin('kmhs', 'km/h per second', 'km/h/s', 1 / 3.6, { c: 1 }),
      lin('mphs', 'mph per second', 'mph/s', 0.44704),
      lin('gal', 'Gal (cm/s²)', 'Gal', 0.01, { al: 'galileo' }),
    ],
  },
  light: {
    name: 'Illuminance', base: 'lx', units: [
      lin('lx', 'Lux', 'lx', 1, { c: 1, al: 'lux' }),
      lin('fc', 'Foot-candle', 'fc', 10.763910416709722, { c: 1, al: 'foot candle footcandle' }),
      lin('klx', 'Kilolux', 'klx', 1000, { c: 1 }),
      lin('ph', 'Phot', 'ph', 1e4),
      lin('nx', 'Nox', 'nx', 1e-3),
    ],
  },
  data: {
    name: 'Data size', base: 'B', units: [
      lin('bit', 'Bit', 'bit', 0.125, { c: 1, al: 'bits b' }),
      lin('B', 'Byte', 'B', 1, { c: 1, al: 'byte bytes octet octets' }),
      lin('kB', 'Kilobyte', 'kB', 1e3, { c: 1, al: 'kb kilobyte kilobytes ko' }),
      lin('MB', 'Megabyte', 'MB', 1e6, { c: 1, al: 'mb megabyte megabytes mo' }),
      lin('GB', 'Gigabyte', 'GB', 1e9, { c: 1, al: 'gb gigabyte gigabytes go gig gigs' }),
      lin('TB', 'Terabyte', 'TB', 1e12, { c: 1, al: 'tb terabyte terabytes to' }),
      lin('KiB', 'Kibibyte', 'KiB', 1024, { c: 1, al: 'kib' }),
      lin('MiB', 'Mebibyte', 'MiB', 1048576, { c: 1, al: 'mib' }),
      lin('GiB', 'Gibibyte', 'GiB', 1073741824, { c: 1, al: 'gib' }),
      lin('TiB', 'Tebibyte', 'TiB', 1099511627776, { c: 1, al: 'tib' }),
      lin('PB', 'Petabyte', 'PB', 1e15, { al: 'pb petabyte' }),
      lin('EB', 'Exabyte', 'EB', 1e18, { al: 'eb exabyte' }),
      lin('PiB', 'Pebibyte', 'PiB', 1125899906842624, { al: 'pib' }),
      lin('nibble', 'Nibble', 'nibble', 0.5),
      lin('kbit', 'Kilobit', 'kbit', 125, { al: 'kbit kilobit' }),
      lin('Mbit', 'Megabit', 'Mbit', 125000, { al: 'mbit megabit' }),
      lin('Gbit', 'Gigabit', 'Gbit', 1.25e8, { al: 'gbit gigabit' }),
    ],
  },
  datarate: {
    name: 'Data speed', base: 'bit/s', units: [
      lin('kbps', 'Kilobit per second', 'kbit/s', 1e3, { c: 1, al: 'kbps' }),
      lin('Mbps', 'Megabit per second', 'Mbit/s', 1e6, { c: 1, al: 'mbps mbit megabits' }),
      lin('Gbps', 'Gigabit per second', 'Gbit/s', 1e9, { c: 1, al: 'gbps gbit' }),
      lin('kBps', 'Kilobyte per second', 'kB/s', 8e3, { c: 1, al: 'kbyte/s ko/s' }),
      lin('MBps', 'Megabyte per second', 'MB/s', 8e6, { c: 1, al: 'mbyte/s mo/s' }),
      lin('GBps', 'Gigabyte per second', 'GB/s', 8e9, { c: 1, al: 'gbyte/s go/s' }),
      lin('MiBps', 'Mebibyte per second', 'MiB/s', 8388608, { c: 1, al: 'mib/s' }),
      lin('bps', 'Bit per second', 'bit/s', 1, { al: 'bps' }),
      lin('Bps', 'Byte per second', 'B/s', 8, { al: 'byte/s' }),
      lin('Tbps', 'Terabit per second', 'Tbit/s', 1e12, { al: 'tbps' }),
      lin('KiBps', 'Kibibyte per second', 'KiB/s', 8192),
      lin('GiBps', 'Gibibyte per second', 'GiB/s', 8589934592),
    ],
  },
  numbers: {
    name: 'Big numbers', base: '1', units: [
      lin('one', 'Units (ones)', '×1', 1, { c: 1 }),
      lin('thousand', 'Thousand', '10³', 1e3, { c: 1, al: 'thousand thousands k mille' }),
      lin('lakh', 'Lakh', '10⁵', 1e5, { c: 1, al: 'lakh lac lakhs' }),
      lin('million', 'Million', '10⁶', 1e6, { c: 1, al: 'million millions mn' }),
      lin('crore', 'Crore', '10⁷', 1e7, { c: 1, al: 'crore crores' }),
      lin('billion', 'Billion (US/UK) = milliard', '10⁹', 1e9, { c: 1, al: 'billion billions bn milliard milliards' }),
      lin('trillion', 'Trillion (US/UK) = billion (FR/DE)', '10¹²', 1e12, { c: 1, al: 'trillion trillions tn' }),
      lin('quadrillion', 'Quadrillion (US/UK) = billiard', '10¹⁵', 1e15, { c: 1, al: 'quadrillion billiard' }),
      lin('dozen', 'Dozen', '12', 12, { al: 'dozen dozens' }),
      lin('score', 'Score', '20', 20),
      lin('gross', 'Gross', '144', 144),
      lin('hundred', 'Hundred', '10²', 100, { al: 'hundred hundreds' }),
      lin('pct', 'Percent', '%', 0.01, { al: 'percent' }),
      lin('permille', 'Per mille', '‰', 0.001, { al: 'permille per mil' }),
      lin('ppm', 'Parts per million', 'ppm', 1e-6, { al: 'ppm' }),
      lin('ppb', 'Parts per billion', 'ppb', 1e-9, { al: 'ppb' }),
    ],
  },
  /* ---- categories used by special tools (with params or rounding) ---- */
  css: {
    name: 'CSS units', base: 'in', params: [
      { id: 'font', label: 'Font size (em / rem)', def: 16, suffix: 'px' },
      { id: 'dpi', label: 'Pixel density', def: 96, suffix: 'dpi', hint: 'CSS is 96; print 300' },
    ], units: [
      lin('px', 'Pixel', 'px', p => 1 / p.dpi, { c: 1 }),
      lin('pt', 'Point', 'pt', 1 / 72, { c: 1, al: 'point points' }),
      lin('em', 'Em / rem', 'em', p => p.font / p.dpi, { c: 1, al: 'rem' }),
      lin('pctf', 'Percent of font size', '%', p => p.font / p.dpi / 100, { c: 1 }),
      lin('pc', 'Pica', 'pc', 1 / 6, { c: 1, al: 'pica picas' }),
      lin('in', 'Inch', 'in', 1, { c: 1 }),
      lin('cm', 'Centimeter', 'cm', 1 / 2.54, { c: 1 }),
      lin('mm', 'Millimeter', 'mm', 1 / 25.4, { c: 1 }),
      lin('q', 'Quarter-millimeter', 'Q', 1 / 101.6),
    ],
  },
  salary: {
    name: 'Salary', base: 'per hour', money: true, params: [
      { id: 'hpw', label: 'Hours per week', def: 35, suffix: 'h' },
      { id: 'dpw', label: 'Days per week', def: 5, suffix: 'days' },
      { id: 'wpy', label: 'Paid weeks per year', def: 52, suffix: 'wk' },
    ], units: [
      // base = pay per hour, so an amount per period is divided by the hours in that period
      lin('hour', 'Hourly', '/ hour', 1, { c: 1 }),
      lin('day', 'Daily', '/ day', p => 1 / (p.hpw / p.dpw), { c: 1 }),
      lin('week', 'Weekly', '/ week', p => 1 / p.hpw, { c: 1 }),
      lin('biweek', 'Every 2 weeks', '/ 2 weeks', p => 1 / (p.hpw * 2), { c: 1 }),
      lin('month', 'Monthly', '/ month', p => 1 / (p.hpw * p.wpy / 12), { c: 1 }),
      lin('year', 'Yearly', '/ year', p => 1 / (p.hpw * p.wpy), { c: 1 }),
    ],
  },
  oven: {
    name: 'Oven temperature', base: '°C', units: [
      U('c', 'Celsius (conventional)', '°C', null, { c: 1, to: x => x, from: b => b, step: 5 }),
      U('cfan', 'Celsius (fan / convection)', '°C fan', null, { c: 1, to: x => x + 20, from: b => b - 20, step: 5 }),
      U('f', 'Fahrenheit', '°F', null, { c: 1, to: x => (x - 32) * 5 / 9, from: b => b * 9 / 5 + 32, step: 25 }),
      U('gas', 'Gas mark', 'Gas', null, {
        c: 1, options: [0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(g => [g, g === 0.25 ? '¼' : g === 0.5 ? '½' : String(g)]),
        to: g => ((g >= 1 ? 250 + 25 * g : 200 + 100 * g) - 32) * 5 / 9,
        from: b => { const f = b * 9 / 5 + 32; return f >= 275 ? (f - 250) / 25 : (f - 200) / 100; },
      }),
      U('th', 'Thermostat (France)', 'Th', null, { c: 1, to: t => t * 30, from: b => b / 30, step: 0.5 }),
    ],
  },
  shoes: {
    name: 'Shoe sizes', base: 'last in', approx: true, units: [
      U('eu', 'EU', 'EU', null, { c: 1, to: x => x / 3.81, from: b => b * 3.81, step: 0.5 }),
      U('uk', 'UK', 'UK', null, { c: 1, to: x => (x + 25) / 3, from: b => b * 3 - 25, step: 0.5 }),
      U('usm', 'US men', 'US M', null, { c: 1, to: x => (x + 24) / 3, from: b => b * 3 - 24, step: 0.5 }),
      U('usw', 'US women', 'US W', null, { c: 1, to: x => (x + 23) / 3, from: b => b * 3 - 23, step: 0.5 }),
      U('cm', 'Foot length (cm) / Japan', 'cm', null, { c: 1, to: x => (x + 1) / 2.54, from: b => b * 2.54 - 1, step: 0.5 }),
      U('in', 'Foot length (inches)', 'in', null, { c: 1, to: x => (x * 2.54 + 1) / 2.54, from: b => (b * 2.54 - 1) / 2.54, step: 0.125 }),
      U('mondo', 'Mondopoint (mm)', 'mm', null, { c: 1, to: x => (x / 10 + 1) / 2.54, from: b => (b * 2.54 - 1) * 10, step: 5 }),
    ],
  },
  rings: {
    name: 'Ring sizes', base: 'circumference mm', approx: true, units: [
      U('circ', 'EU / France (circumference mm)', 'EU', null, { c: 1, to: x => x, from: b => b, step: 0.5 }),
      U('diam', 'Inside diameter', 'mm', null, { c: 1, to: x => x * PI, from: b => b / PI, step: 0.1 }),
      U('us', 'US / Canada', 'US', null, { c: 1, to: x => (11.6332 + 0.8128 * x) * PI, from: b => (b / PI - 11.6332) / 0.8128, step: 0.25 }),
      U('uk', 'UK / Australia', 'UK', null, {
        c: 1, options: Array.from({ length: 60 }, (_, i) => { const idx = i / 2; const L = idx < 26 ? String.fromCharCode(65 + Math.floor(idx)) : 'Z+' + (Math.floor(idx) - 25); return [idx, L + (i % 2 ? '½' : '')]; }),
        to: i => 37.8 + 1.25 * i, from: b => (b - 37.8) / 1.25,
      }),
      U('jp', 'Japan', 'JP', null, { c: 1, to: x => x + 40, from: b => b - 40, step: 1 }),
      U('ch', 'Switzerland', 'CH', null, { c: 1, to: x => x + 40, from: b => b - 40, step: 0.5 }),
    ],
  },
  wire: {
    name: 'Wire gauge', base: 'mm', units: [
      U('awg', 'AWG', 'AWG', null, {
        c: 1, options: [-3, -2, -1, ...Array.from({ length: 41 }, (_, i) => i)].map(n => [n, n < 0 ? `${1 - n}/0` : String(n)]),
        to: n => 0.127 * Math.pow(92, (36 - n) / 39), from: d => 36 - 39 * Math.log(d / 0.127) / Math.log(92),
      }),
      U('dmm', 'Diameter (mm)', 'mm', null, { c: 1, to: x => x, from: b => b }),
      U('din', 'Diameter (inches)', 'in', null, { c: 1, to: x => x * 25.4, from: b => b / 25.4 }),
      U('amm2', 'Cross-section (mm²)', 'mm²', null, { c: 1, to: a => Math.sqrt(4 * a / PI), from: d => PI / 4 * d * d }),
      U('kcmil', 'Cross-section (kcmil)', 'kcmil', null, { c: 1, to: k => Math.sqrt(k * 1000) * 0.0254, from: d => Math.pow(d / 0.0254, 2) / 1000 }),
    ],
  },
  blood: {
    name: 'Blood values', maxDec: 2, groups: {
      glucose: { name: 'Glucose', units: [lin('mmol', 'Millimoles per liter', 'mmol/L', 1, { c: 1 }), lin('mgdl', 'Milligrams per deciliter', 'mg/dL', 1 / 18.016, { c: 1 })] },
      a1c: {
        name: 'HbA1c', units: [
          U('pct', 'HbA1c (NGSP)', '%', null, { c: 1, to: x => x, from: b => b }),
          U('mmolmol', 'HbA1c (IFCC)', 'mmol/mol', null, { c: 1, to: x => x / 10.929 + 2.15, from: b => (b - 2.15) * 10.929 }),
          U('eagmg', 'Average glucose (eAG)', 'mg/dL', null, { c: 1, to: x => (x + 46.7) / 28.7, from: b => 28.7 * b - 46.7 }),
          U('eagmmol', 'Average glucose (eAG)', 'mmol/L', null, { c: 1, to: x => (x * 18.016 + 46.7) / 28.7, from: b => (28.7 * b - 46.7) / 18.016 }),
        ],
      },
      chol: { name: 'Cholesterol', units: [lin('mmol', 'Millimoles per liter', 'mmol/L', 1, { c: 1 }), lin('mgdl', 'Milligrams per deciliter', 'mg/dL', 1 / 38.67, { c: 1 })] },
      tg: { name: 'Triglycerides', units: [lin('mmol', 'Millimoles per liter', 'mmol/L', 1, { c: 1 }), lin('mgdl', 'Milligrams per deciliter', 'mg/dL', 1 / 88.57, { c: 1 })] },
      creat: { name: 'Creatinine', units: [lin('umol', 'Micromoles per liter', 'µmol/L', 1, { c: 1 }), lin('mgdl', 'Milligrams per deciliter', 'mg/dL', 88.42, { c: 1 })] },
      vitd: { name: 'Vitamin D', units: [lin('nmol', 'Nanomoles per liter', 'nmol/L', 1, { c: 1 }), lin('ngml', 'Nanograms per milliliter', 'ng/mL', 2.496, { c: 1 })] },
    },
  },
};

/* ---------- finalize: toBase / fromBase for every unit ---------- */
function finalize(cat, catId) {
  for (const u of cat.units) {
    u.cat = catId;
    if (u.parts && !u.to) { u.toBase = x => x; u.fromBase = b => b; }
    else if (u.to) { u.toBase = (x) => u.to(x); u.fromBase = (b) => u.from(b); }
    else if (typeof u.f === 'function') { u.toBase = (x, p) => x * u.f(p); u.fromBase = (b, p) => b / u.f(p); }
    else { u.toBase = x => x * u.f; u.fromBase = b => b / u.f; }
  }
}
for (const [id, cat] of Object.entries(CATEGORIES)) {
  cat.id = id;
  if (cat.groups) for (const [gid, g] of Object.entries(cat.groups)) { g.id = gid; finalize(g, id + '.' + gid); }
  else finalize(cat, id);
}

// US spelling → international for non-US English
export function localName(name) {
  let lang = 'en-US';
  try { lang = navigator.language || 'en-US'; } catch { }
  if (/^en-US/i.test(lang) || !/^en/i.test(lang)) return name;
  return name.replace(/(\w*)([mM])eter/g, (m, pre, M) => (/dia$/i.test(pre) ? m : pre + M + 'etre')).replace(/([lL])iter/g, '$1itre');
}

export function unitsOf(catId) {
  const [c, g] = catId.split('.');
  const cat = CATEGORIES[c];
  return g ? cat.groups[g].units : cat.units;
}
export function unit(catId, id) { return unitsOf(catId).find(u => u.id === id); }

/** Convert value between two units of a category (scalar units only). */
export function convert(catId, x, fromId, toId, p) {
  const a = unit(catId, fromId), b = unit(catId, toId);
  return b.fromBase(a.toBase(x, p), p);
}

/** Pick a sensible default unit for the user's measurement system. */
export function defaultUnit(catId, system, metricId, imperialId, ukId) {
  if (system === 'metric') return metricId;
  if (system === 'uk' && ukId) return ukId;
  return imperialId || metricId;
}
