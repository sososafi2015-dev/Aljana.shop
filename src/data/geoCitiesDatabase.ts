/**
 * Comprehensive Geographical Database of Cities and Regions
 * Fully localized in Arabic with search aliases (French, English, alternative spellings)
 */

export interface CityInfo {
  name: string; // Official Arabic name (e.g. "الدار البيضاء")
  nameFr?: string; // French / Latin name (e.g. "Casablanca")
  region?: string; // Province / Region / Administrative Area
  aliases?: string[]; // Alternative search keywords
}

export interface CountryGeoData {
  id: string; // ISO Code e.g. "MA", "SA"
  nameAr: string; // "المغرب"
  nameEn: string; // "Morocco"
  nameFr: string; // "Maroc"
  flag: string;
  cities: CityInfo[];
}

export const GEO_DATABASE: Record<string, CountryGeoData> = {
  MA: {
    id: 'MA',
    nameAr: 'المغرب',
    nameEn: 'Morocco',
    nameFr: 'Maroc',
    flag: '🇲🇦',
    cities: [
      { name: 'الدار البيضاء', nameFr: 'Casablanca', region: 'الدار البيضاء - سطات', aliases: ['كازا', 'Casa'] },
      { name: 'الرباط', nameFr: 'Rabat', region: 'الرباط - سلا - القنيطرة', aliases: ['العاصمة'] },
      { name: 'فاس', nameFr: 'Fès', region: 'فاس - مكناس', aliases: ['Fez'] },
      { name: 'مراكش', nameFr: 'Marrakech', region: 'مراكش - آسفي', aliases: ['المدينة الحمراء'] },
      { name: 'طنجة', nameFr: 'Tanger', region: 'طنجة - تطوان - الحسيمة', aliases: ['Tangier'] },
      { name: 'أكادير', nameFr: 'Agadir', region: 'سوس - ماسة', aliases: ['Agadir Ida-Outanane'] },
      { name: 'مكناس', nameFr: 'Meknès', region: 'فاس - مكناس', aliases: ['Meknes'] },
      { name: 'وجدة', nameFr: 'Oujda', region: 'الشرق' },
      { name: 'القنيطرة', nameFr: 'Kénitra', region: 'الرباط - سلا - القنيطرة', aliases: ['Kenitra', 'Port Lyautey'] },
      { name: 'تطوان', nameFr: 'Tétouan', region: 'طنجة - تطوان - الحسيمة', aliases: ['Tetouan', 'الحمامة البيضاء'] },
      { name: 'خنيفرة', nameFr: 'Khénifra', region: 'بني ملال - خنيفرة', aliases: ['Khenifra', 'زيان'] },
      { name: 'سلا', nameFr: 'Salé', region: 'الرباط - سلا - القنيطرة', aliases: ['Sale'] },
      { name: 'تمارة', nameFr: 'Témara', region: 'الرباط - سلا - القنيطرة', aliases: ['Temara'] },
      { name: 'العيون', nameFr: 'Laâyoune', region: 'العيون - الساقية الحمراء', aliases: ['Laayoune', 'العيون الساقية الحمراء'] },
      { name: 'آسفي', nameFr: 'Safi', region: 'مراكش - آسفي', aliases: ['اسفي', 'حاضرة المحيط'] },
      { name: 'بني ملال', nameFr: 'Béni Mellal', region: 'بني ملال - خنيفرة', aliases: ['Beni Mellal'] },
      { name: 'الجديدة', nameFr: 'El Jadida', region: 'الدار البيضاء - سطات', aliases: ['Mazagan', 'مازاغان'] },
      { name: 'تازة', nameFr: 'Taza', region: 'فاس - مكناس' },
      { name: 'الناظور', nameFr: 'Nador', region: 'الشرق' },
      { name: 'سطات', nameFr: 'Settat', region: 'الدار البيضاء - سطات' },
      { name: 'القصر الكبير', nameFr: 'Ksar El Kébir', region: 'طنجة - تطوان - الحسيمة' },
      { name: 'العرائش', nameFr: 'Larache', region: 'طنجة - تطوان - الحسيمة' },
      { name: 'الخميسات', nameFr: 'Khémisset', region: 'الرباط - سلا - القنيطرة', aliases: ['Khemisset'] },
      { name: 'كلميم', nameFr: 'Guelmim', region: 'كلميم - واد نون', aliases: ['باب الصحراء'] },
      { name: 'بركان', nameFr: 'Berkane', region: 'الشرق', aliases: ['عاصمة البرتقال'] },
      { name: 'تاوريرت', nameFr: 'Taourirt', region: 'الشرق' },
      { name: 'برشيد', nameFr: 'Berrechid', region: 'الدار البيضاء - سطات' },
      { name: 'وادي زم', nameFr: 'Oued Zem', region: 'بني ملال - خنيفرة' },
      { name: 'الفقيه بن صالح', nameFr: 'Fquih Ben Salah', region: 'بني ملال - خنيفرة' },
      { name: 'تاونات', nameFr: 'Taounate', region: 'فاس - مكناس' },
      { name: 'الرشيدية', nameFr: 'Errachidia', region: 'درعة - تافيلالت', aliases: ['قصر السوق'] },
      { name: 'ورزازات', nameFr: 'Ouarzazate', region: 'درعة - تافيلالت', aliases: ['هوليوود إفريقيا'] },
      { name: 'تيزنيت', nameFr: 'Tiznit', region: 'سوس - ماسة', aliases: ['عاصمة الفضة'] },
      { name: 'تارودانت', nameFr: 'Taroudant', region: 'سوس - ماسة' },
      { name: 'الصويرة', nameFr: 'Essaouira', region: 'مراكش - آسفي', aliases: ['موغادور', 'Mogador'] },
      { name: 'الفنيدق', nameFr: 'Fnideq', region: 'طنجة - تطوان - الحسيمة', aliases: ['Castillejos'] },
      { name: 'المضيق', nameFr: 'Mdiq', region: 'طنجة - تطوان - الحسيمة', aliases: ['رينكون', 'Rincon'] },
      { name: 'سيدي قاسم', nameFr: 'Sidi Kacem', region: 'الرباط - سلا - القنيطرة' },
      { name: 'خريبكة', nameFr: 'Khouribga', region: 'بني ملال - خنيفرة', aliases: ['عاصمة الفوسفاط'] },
      { name: 'الداخلة', nameFr: 'Dakhla', region: 'الداخلة - وادي الذهب', aliases: ['Villa Cisneros', 'وادي الذهب'] },
      { name: 'الحسيمة', nameFr: 'Al Hoceïma', region: 'طنجة - تطوان - الحسيمة', aliases: ['Al Hoceima'] },
      { name: 'تيفلت', nameFr: 'Tiflet', region: 'الرباط - سلا - القنيطرة' },
      { name: 'أولاد تايمة', nameFr: 'Oulad Teïma', region: 'سوس - ماسة', aliases: ['44'] },
      { name: 'صفرو', nameFr: 'Séfrou', region: 'فاس - مكناس', aliases: ['Sefrou'] },
      { name: 'اليوسفية', nameFr: 'Youssoufia', region: 'مراكش - آسفي' },
      { name: 'تنغير', nameFr: 'Tinghir', region: 'درعة - تافيلالت', aliases: ['مضايق تودغى'] },
      { name: 'سيدي سليمان', nameFr: 'Sidi Slimane', region: 'الرباط - سلا - القنيطرة' },
      { name: 'شفشاون', nameFr: 'Chefchaouen', region: 'طنجة - تطوان - الحسيمة', aliases: ['الجوهرة الزرقاء', 'Chaouen'] },
      { name: 'ميدلت', nameFr: 'Midelt', region: 'درعة - تافيلالت', aliases: ['عاصمة التفاح'] },
      { name: 'بوزنيقة', nameFr: 'Bouznika', region: 'الدار البيضاء - سطات' },
      { name: 'أصيلة', nameFr: 'Asilah', region: 'طنجة - تطوان - الحسيمة', aliases: ['اصيلة'] },
      { name: 'وزان', nameFr: 'Ouazzane', region: 'طنجة - تطوان - الحسيمة', aliases: ['دار الضمانة'] },
      { name: 'قلعة السراغنة', nameFr: 'El Kelaâ des Sraghna', region: 'مراكش - آسفي' },
      { name: 'زاكورة', nameFr: 'Zagora', region: 'درعة - تافيلالت' },
      { name: 'سيدي إفني', nameFr: 'Sidi Ifni', region: 'كلميم - واد نون' },
      { name: 'بوجدور', nameFr: 'Boujdour', region: 'العيون - الساقية الحمراء' },
      { name: 'أزرو', nameFr: 'Azrou', region: 'فاس - مكناس' },
      { name: 'إفران', nameFr: 'Ifrane', region: 'فاس - مكناس', aliases: ['سويسرا المغرب'] },
      { name: 'جرادة', nameFr: 'Jerada', region: 'الشرق' },
      { name: 'الدريوش', nameFr: 'Driouch', region: 'الشرق' },
      { name: 'طانطان', nameFr: 'Tan-Tan', region: 'كلميم - واد نون' },
      { name: 'فكيك', nameFr: 'Figuig', region: 'الشرق' },
      { name: 'السمارة', nameFr: 'Es-Semara', region: 'العيون - الساقية الحمراء' },
      { name: 'أوسرد', nameFr: 'Aousserd', region: 'الداخلة - وادي الذهب' },
      { name: 'تارجيست', nameFr: 'Targuist', region: 'طنجة - تطوان - الحسيمة' },
      { name: 'أرفود', nameFr: 'Erfoud', region: 'درعة - تافيلالت' },
      { name: 'الريصاني', nameFr: 'Rissani', region: 'درعة - تافيلالت', aliases: ['سجلماسة'] },
      { name: 'سيدي بنور', nameFr: 'Sidi Bennour', region: 'الدار البيضاء - سطات' },
      { name: 'بنجرير', nameFr: 'Benguerir', region: 'مراكش - آسفي', aliases: ['المدينة الخضراء'] },
      { name: 'سوق الأربعاء', nameFr: 'Souk El Arbaa', region: 'الرباط - سلا - القنيطرة' },
      { name: 'ميسور', nameFr: 'Missour', region: 'فاس - مكناس' },
      { name: 'بولمان', nameFr: 'Boulemane', region: 'فاس - مكناس' },
      { name: 'عين عودة', nameFr: 'Aïn El Aouda', region: 'الرباط - سلا - القنيطرة' },
      { name: 'الهرهورة', nameFr: 'Harhoura', region: 'الرباط - سلا - القنيطرة' },
      { name: 'ميرلفت', nameFr: 'Mirleft', region: 'كلميم - واد نون' },
    ],
  },

  SA: {
    id: 'SA',
    nameAr: 'السعودية',
    nameEn: 'Saudi Arabia',
    nameFr: 'Arabie Saoudite',
    flag: '🇸🇦',
    cities: [
      { name: 'الرياض', nameFr: 'Riyadh', region: 'منطقة الرياض', aliases: ['العاصمة'] },
      { name: 'جدة', nameFr: 'Jeddah', region: 'منطقة مكة المكرمة', aliases: ['عروس البحر الأحمر'] },
      { name: 'مكة المكرمة', nameFr: 'Makkah', region: 'منطقة مكة المكرمة', aliases: ['مكة', 'العاصمة المقدسة'] },
      { name: 'المدينة المنورة', nameFr: 'Madinah', region: 'منطقة المدينة المنورة', aliases: ['المدينة', 'طيبة'] },
      { name: 'الدمام', nameFr: 'Dammam', region: 'المنطقة الشرقية' },
      { name: 'الخبر', nameFr: 'Khobar', region: 'المنطقة الشرقية' },
      { name: 'الظهران', nameFr: 'Dhahran', region: 'المنطقة الشرقية' },
      { name: 'الأحساء', nameFr: 'Al-Ahsa', region: 'المنطقة الشرقية', aliases: ['الهفوف', 'المبرز'] },
      { name: 'الطائف', nameFr: 'Taif', region: 'منطقة مكة المكرمة', aliases: ['عروس المصائف'] },
      { name: 'تبوك', nameFr: 'Tabuk', region: 'منطقة تبوك' },
      { name: 'بريدة', nameFr: 'Buraidah', region: 'منطقة القصيم' },
      { name: 'عنيزة', nameFr: 'Unaizah', region: 'منطقة القصيم' },
      { name: 'حائل', nameFr: 'Hail', region: 'منطقة حائل' },
      { name: 'أبها', nameFr: 'Abha', region: 'منطقة عسير' },
      { name: 'خميس مشيط', nameFr: 'Khamis Mushait', region: 'منطقة عسير' },
      { name: 'نجران', nameFr: 'Najran', region: 'منطقة نجران' },
      { name: 'جازان', nameFr: 'Jazan', region: 'منطقة جازان', aliases: ['جيزان'] },
      { name: 'الجبيل', nameFr: 'Jubail', region: 'المنطقة الشرقية' },
      { name: 'ينبع', nameFr: 'Yanbu', region: 'منطقة المدينة المنورة' },
      { name: 'حفر الباطن', nameFr: 'Hafar Al-Batin', region: 'المنطقة الشرقية' },
      { name: 'الخرج', nameFr: 'Al-Kharj', region: 'منطقة الرياض' },
      { name: 'القنفذة', nameFr: 'Al Qunfudhah', region: 'منطقة مكة المكرمة' },
      { name: 'عرعر', nameFr: 'Arar', region: 'منطقة الحدود الشمالية' },
      { name: 'سكاكا', nameFr: 'Sakaka', region: 'منطقة الجوف' },
      { name: 'بيشة', nameFr: 'Bisha', region: 'منطقة عسير' },
      { name: 'محايل عسير', nameFr: 'Muhayil Asir', region: 'منطقة عسير' },
      { name: 'الزلفي', nameFr: 'Zulfi', region: 'منطقة الرياض' },
      { name: 'الدوادمي', nameFr: 'Dawadmi', region: 'منطقة الرياض' },
      { name: 'شرورة', nameFr: 'Sharurah', region: 'منطقة نجران' },
      { name: 'رابغ', nameFr: 'Rabigh', region: 'منطقة مكة المكرمة' },
      { name: 'صبيا', nameFr: 'Sabya', region: 'منطقة جازان' },
      { name: 'دومة الجندل', nameFr: 'Dumat Al-Jandal', region: 'منطقة الجوف' },
      { name: 'طريف', nameFr: 'Turaif', region: 'منطقة الحدود الشمالية' },
      { name: 'الباحة', nameFr: 'Al Bahah', region: 'منطقة الباحة' },
      { name: 'الرس', nameFr: 'Ar Rass', region: 'منطقة القصيم' },
      { name: 'عفيف', nameFr: 'Afif', region: 'منطقة الرياض' },
      { name: 'وادي الدواسر', nameFr: 'Wadi ad-Dawasir', region: 'منطقة الرياض' },
      { name: 'المجمعة', nameFr: 'Al Majmaah', region: 'منطقة الرياض' },
      { name: 'القريات', nameFr: 'Al Qurayyat', region: 'منطقة الجوف' },
      { name: 'العلا', nameFr: 'Al-Ula', region: 'منطقة المدينة المنورة' },
    ],
  },

  EG: {
    id: 'EG',
    nameAr: 'مصر',
    nameEn: 'Egypt',
    nameFr: 'Égypte',
    flag: '🇪🇬',
    cities: [
      { name: 'القاهرة', nameFr: 'Cairo', region: 'محافظة القاهرة', aliases: ['العاصمة', 'مصر القديمة'] },
      { name: 'الإسكندرية', nameFr: 'Alexandria', region: 'محافظة الإسكندرية', aliases: ['عروس البحر المتوسط', 'Alex'] },
      { name: 'الجيزة', nameFr: 'Giza', region: 'محافظة الجيزة', aliases: ['الأهرامات'] },
      { name: 'بورسعيد', nameFr: 'Port Said', region: 'محافظة بورسعيد' },
      { name: 'السويس', nameFr: 'Suez', region: 'محافظة السويس' },
      { name: 'المنصورة', nameFr: 'Mansoura', region: 'محافظة الدقهلية' },
      { name: 'طنطا', nameFr: 'Tanta', region: 'محافظة الغربية' },
      { name: 'الإسماعيلية', nameFr: 'Ismailia', region: 'محافظة الإسماعيلية' },
      { name: 'أسيوط', nameFr: 'Asyut', region: 'محافظة أسيوط' },
      { name: 'الفيوم', nameFr: 'Fayoum', region: 'محافظة الفيوم' },
      { name: 'الزقازيق', nameFr: 'Zagazig', region: 'محافظة الشرقية' },
      { name: 'دمياط', nameFr: 'Damietta', region: 'محافظة دمياط' },
      { name: 'أسوان', nameFr: 'Aswan', region: 'محافظة أسوان' },
      { name: 'الأقصر', nameFr: 'Luxor', region: 'محافظة الأقصر' },
      { name: 'المنيا', nameFr: 'Minya', region: 'محافظة المنيا' },
      { name: 'بني سويف', nameFr: 'Beni Suef', region: 'محافظة بني سويف' },
      { name: 'قنا', nameFr: 'Qena', region: 'محافظة قنا' },
      { name: 'سوهاج', nameFr: 'Sohag', region: 'محافظة سوهاج' },
      { name: 'كفر الشيخ', nameFr: 'Kafr El Sheikh', region: 'محافظة كفر الشيخ' },
      { name: 'دمنهور', nameFr: 'Damanhur', region: 'محافظة البحيرة' },
      { name: 'شبين الكوم', nameFr: 'Shibin El Kom', region: 'محافظة المنوفية' },
      { name: 'بنها', nameFr: 'Banha', region: 'محافظة القليوبية' },
      { name: 'الغردقة', nameFr: 'Hurghada', region: 'محافظة البحر الأحمر' },
      { name: 'شرم الشيخ', nameFr: 'Sharm El Sheikh', region: 'محافظة جنوب سيناء' },
      { name: 'العريش', nameFr: 'Arish', region: 'محافظة شمال سيناء' },
      { name: 'مرسى مطروح', nameFr: 'Marsa Matruh', region: 'محافظة مطروح' },
      { name: 'المحلة الكبرى', nameFr: 'El Mahalla El Kubra', region: 'محافظة الغربية' },
      { name: 'العاشر من رمضان', nameFr: '10th of Ramadan', region: 'محافظة الشرقية' },
      { name: '6 أكتوبر', nameFr: '6th of October', region: 'محافظة الجيزة', aliases: ['السادس من أكتوبر', 'أكتوبر'] },
      { name: 'الشيخ زايد', nameFr: 'Sheikh Zayed City', region: 'محافظة الجيزة' },
      { name: 'العاصمة الإدارية الجديدة', nameFr: 'New Administrative Capital', region: 'القاهرة الكبرى' },
      { name: 'حلوان', nameFr: 'Helwan', region: 'محافظة القاهرة' },
      { name: 'شبرا الخيمة', nameFr: 'Shubra El Kheima', region: 'محافظة القليوبية' },
      { name: 'نجع حمادي', nameFr: 'Nag Hammadi', region: 'محافظة قنا' },
      { name: 'ملوي', nameFr: 'Mallawi', region: 'محافظة المنيا' },
      { name: 'دسوق', nameFr: 'Desouk', region: 'محافظة كفر الشيخ' },
      { name: 'إدفو', nameFr: 'Edfu', region: 'محافظة أسوان' },
    ],
  },

  DZ: {
    id: 'DZ',
    nameAr: 'الجزائر',
    nameEn: 'Algeria',
    nameFr: 'Algérie',
    flag: '🇩🇿',
    cities: [
      { name: 'الجزائر العاصمة', nameFr: 'Alger', region: 'ولاية الجزائر', aliases: ['الجزائر', 'البهجة', 'Algiers'] },
      { name: 'وهران', nameFr: 'Oran', region: 'ولاية وهران', aliases: ['الباهية'] },
      { name: 'قسنطينة', nameFr: 'Constantine', region: 'ولاية قسنطينة', aliases: ['مدينة الجسور المعلقة'] },
      { name: 'عنابة', nameFr: 'Annaba', region: 'ولاية عنابة', aliases: ['بونة'] },
      { name: 'سطيف', nameFr: 'Sétif', region: 'ولاية سطيف', aliases: ['عاصمة الهضاب'] },
      { name: 'باتنة', nameFr: 'Batna', region: 'ولاية باتنة', aliases: ['عاصمة الأوراس'] },
      { name: 'الجلفة', nameFr: 'Djelfa', region: 'ولاية الجلفة' },
      { name: 'بسكرة', nameFr: 'Biskra', region: 'ولاية بسكرة', aliases: ['عروس الزيبان'] },
      { name: 'الشلف', nameFr: 'Chlef', region: 'ولاية الشلف', aliases: ['الأصنام'] },
      { name: 'سيدي بلعباس', nameFr: 'Sidi Bel Abbès', region: 'ولاية سيدي بلعباس' },
      { name: 'تلمسان', nameFr: 'Tlemcen', region: 'ولاية تلمسان', aliases: ['لؤلؤة المغرب العربي'] },
      { name: 'سكيكدة', nameFr: 'Skikda', region: 'ولاية سكيكدة', aliases: ['روسيكادا'] },
      { name: 'تيارت', nameFr: 'Tiaret', region: 'ولاية تيارت' },
      { name: 'بجاية', nameFr: 'Béjaïa', region: 'ولاية بجاية', aliases: ['الناصرية'] },
      { name: 'تيزي وزو', nameFr: 'Tizi Ouzou', region: 'ولاية تيزي وزو', aliases: ['عاصمة جرجرة'] },
      { name: 'البليدة', nameFr: 'Blida', region: 'ولاية البليدة', aliases: ['مدينة الورود'] },
      { name: 'مستغانم', nameFr: 'Mostaganem', region: 'ولاية مستغانم' },
      { name: 'المسيلة', nameFr: "M'Sila", region: 'ولاية المسيلة' },
      { name: 'معسكر', nameFr: 'Mascara', region: 'ولاية معسكر', aliases: ['مدينة الأمير عبد القادر'] },
      { name: 'ورقلة', nameFr: 'Ouargla', region: 'ولاية ورقلة' },
      { name: 'بومرداس', nameFr: 'Boumerdès', region: 'ولاية بومرداس' },
      { name: 'برج بوعريريج', nameFr: 'Bordj Bou Arréridj', region: 'ولاية برج بوعريريج' },
      { name: 'غليزان', nameFr: 'Relizane', region: 'ولاية غليزان' },
      { name: 'الوادي', nameFr: 'El Oued', region: 'ولاية الوادي', aliases: ['مدينة الألف قبة'] },
      { name: 'خنشلة', nameFr: 'Khenchela', region: 'ولاية خنشلة' },
      { name: 'سوق أهراس', nameFr: 'Souk Ahras', region: 'ولاية سوق أهراس', aliases: ['طاغاست'] },
      { name: 'ميلة', nameFr: 'Mila', region: 'ولاية ميلة' },
      { name: 'عين الدفلى', nameFr: 'Aïn Defla', region: 'ولاية عين الدفلى' },
      { name: 'غرداية', nameFr: 'Ghardaïa', region: 'ولاية غرداية', aliases: ['وادي ميزاب'] },
      { name: 'أدرار', nameFr: 'Adrar', region: 'ولاية أدرار' },
      { name: 'تندوف', nameFr: 'Tindouf', region: 'ولاية تندوف' },
      { name: 'بشار', nameFr: 'Béchar', region: 'ولاية بشار' },
      { name: 'تمنراست', nameFr: 'Tamanrasset', region: 'ولاية تمنراست', aliases: ['عاصمة الهقار'] },
    ],
  },

  TN: {
    id: 'TN',
    nameAr: 'تونس',
    nameEn: 'Tunisia',
    nameFr: 'Tunisie',
    flag: '🇹🇳',
    cities: [
      { name: 'تونس العاصمة', nameFr: 'Tunis', region: 'ولاية تونس', aliases: ['تونس'] },
      { name: 'صفاقس', nameFr: 'Sfax', region: 'ولاية صفاقس', aliases: ['عاصمة الجنوب'] },
      { name: 'سوسة', nameFr: 'Sousse', region: 'ولاية سوسة', aliases: ['جوهرة الساحل'] },
      { name: 'القيروان', nameFr: 'Kairouan', region: 'ولاية القيروان', aliases: ['رابعة الثلاث'] },
      { name: 'بنزرت', nameFr: 'Bizerte', region: 'ولاية بنزرت' },
      { name: 'قابس', nameFr: 'Gabès', region: 'ولاية قابس' },
      { name: 'أريانة', nameFr: 'Ariana', region: 'ولاية أريانة' },
      { name: 'قفصة', nameFr: 'Gafsa', region: 'ولاية قفصة' },
      { name: 'المروج', nameFr: 'El Mourouj', region: 'ولاية بن عروس' },
      { name: 'مدنين', nameFr: 'Médenine', region: 'ولاية مدنين' },
      { name: 'المنستير', nameFr: 'Monastir', region: 'ولاية المنستير' },
      { name: 'بن عروس', nameFr: 'Ben Arous', region: 'ولاية بن عروس' },
      { name: 'القصرين', nameFr: 'Kasserine', region: 'ولاية القصرين' },
      { name: 'تطاوين', nameFr: 'Tataouine', region: 'ولاية تطاوين' },
      { name: 'جندوبة', nameFr: 'Jendouba', region: 'ولاية جندوبة' },
      { name: 'الكاف', nameFr: 'Le Kef', region: 'ولاية الكاف' },
      { name: 'المهدية', nameFr: 'Mahdia', region: 'ولاية المهدية' },
      { name: 'سيدي بوزيد', nameFr: 'Sidi Bouzid', region: 'ولاية سيدي بوزيد' },
      { name: 'توزر', nameFr: 'Tozeur', region: 'ولاية توزر' },
      { name: 'قبلي', nameFr: 'Kébili', region: 'ولاية قبلي' },
      { name: 'زغوان', nameFr: 'Zaghouan', region: 'ولاية زغوان' },
      { name: 'باجة', nameFr: 'Béja', region: 'ولاية باجة' },
      { name: 'نابل', nameFr: 'Nabeul', region: 'ولاية نابل' },
      { name: 'المرسى', nameFr: 'La Marsa', region: 'ولاية تونس' },
      { name: 'حلق الوادي', nameFr: 'La Goulette', region: 'ولاية تونس' },
    ],
  },

  MR: {
    id: 'MR',
    nameAr: 'موريتانيا',
    nameEn: 'Mauritania',
    nameFr: 'Mauritanie',
    flag: '🇲🇷',
    cities: [
      { name: 'نواكشوط', nameFr: 'Nouakchott', region: 'نواكشوط', aliases: ['العاصمة'] },
      { name: 'نواذيبو', nameFr: 'Nouadhibou', region: 'داخلة نواذيبو', aliases: ['العاصمة الاقتصادية'] },
      { name: 'كيفة', nameFr: 'Kiffa', region: 'العصابة' },
      { name: 'روصو', nameFr: 'Rosso', region: 'الترارزة' },
      { name: 'كيهيدي', nameFr: 'Kaédi', region: 'كوركول' },
      { name: 'ازويرات', nameFr: 'Zouérat', region: 'تيرس زمور' },
      { name: 'أطار', nameFr: 'Atar', region: 'آدرار' },
      { name: 'ألاك', nameFr: 'Aleg', region: 'البراكنة' },
      { name: 'لعيون', nameFr: 'Ayoun el Atrous', region: 'الحوض الغربي' },
      { name: 'سيليبابي', nameFr: 'Sélibaby', region: 'كيدي ماغا' },
      { name: 'تجكجة', nameFr: 'Tidjikja', region: 'تكانت' },
      { name: 'شنقيط', nameFr: 'Chinguetti', region: 'آدرار', aliases: ['مدينة التاريخ'] },
      { name: 'ولاتة', nameFr: 'Oualata', region: 'الحوض الشرقي' },
      { name: 'بوتلميت', nameFr: 'Boutilimit', region: 'الترارزة' },
      { name: 'النعمة', nameFr: 'Néma', region: 'الحوض الشرقي' },
    ],
  },

  LY: {
    id: 'LY',
    nameAr: 'ليبيا',
    nameEn: 'Libya',
    nameFr: 'Libye',
    flag: '🇱🇾',
    cities: [
      { name: 'طرابلس', nameFr: 'Tripoli', region: 'طرابلس الكبرى', aliases: ['عروس البحر', 'العاصمة'] },
      { name: 'بنغازي', nameFr: 'Benghazi', region: 'برقة', aliases: ['عاصمة الشرق'] },
      { name: 'مصراتة', nameFr: 'Misrata', region: 'مصراتة', aliases: ['ذات الرمال'] },
      { name: 'الزاوية', nameFr: 'Zawiya', region: 'الزاوية' },
      { name: 'طبرق', nameFr: 'Tobruk', region: 'البطنان' },
      { name: 'سبها', nameFr: 'Sabha', region: 'فزان', aliases: ['عاصمة الجنوب'] },
      { name: 'درنة', nameFr: 'Derna', region: 'درنة' },
      { name: 'سرت', nameFr: 'Sirte', region: 'سرت' },
      { name: 'الخمس', nameFr: 'Al-Khums', region: 'المرقب' },
      { name: 'زليتن', nameFr: 'Zliten', region: 'المرقب' },
      { name: 'البيضاء', nameFr: 'Bayda', region: 'الجبل الأخضر' },
      { name: 'غريان', nameFr: 'Gharyan', region: 'الجبل الغربي' },
      { name: 'أجدابيا', nameFr: 'Ajdabiya', region: 'الواحات' },
      { name: 'بني وليد', nameFr: 'Bani Walid', region: 'بني وليد' },
      { name: 'الكفرة', nameFr: 'Kufra', region: 'الكفرة' },
      { name: 'صبراتة', nameFr: 'Sabratha', region: 'النقاط الخمس' },
      { name: 'زوارة', nameFr: 'Zuwara', region: 'النقاط الخمس' },
      { name: 'ترهونة', nameFr: 'Tarhuna', region: 'المرقب' },
      { name: 'غدامس', nameFr: 'Ghadames', region: 'نالوت', aliases: ['لؤلؤة الصحراء'] },
    ],
  },

  AE: {
    id: 'AE',
    nameAr: 'الإمارات',
    nameEn: 'United Arab Emirates',
    nameFr: 'Émirats Arabes Unis',
    flag: '🇦🇪',
    cities: [
      { name: 'أبوظبي', nameFr: 'Abu Dhabi', region: 'إمارة أبوظبي', aliases: ['العاصمة'] },
      { name: 'دبي', nameFr: 'Dubai', region: 'إمارة دبي', aliases: ['دانة الدنيا'] },
      { name: 'الشارقة', nameFr: 'Sharjah', region: 'إمارة الشارقة', aliases: ['عاصمة الثقافة'] },
      { name: 'عجمان', nameFr: 'Ajman', region: 'إمارة عجمان' },
      { name: 'رأس الخيمة', nameFr: 'Ras Al Khaimah', region: 'إمارة رأس الخيمة' },
      { name: 'الفجيرة', nameFr: 'Fujairah', region: 'إمارة الفجيرة' },
      { name: 'أم القيوين', nameFr: 'Umm Al Quwain', region: 'إمارة أم القيوين' },
      { name: 'العين', nameFr: 'Al Ain', region: 'إمارة أبوظبي', aliases: ['مدينة الواحات'] },
      { name: 'خورفكان', nameFr: 'Khor Fakkan', region: 'إمارة الشارقة' },
      { name: 'دبا الحصن', nameFr: 'Dibba Al-Hisn', region: 'إمارة الشارقة' },
      { name: 'كلباء', nameFr: 'Kalba', region: 'إمارة الشارقة' },
      { name: 'الرويس', nameFr: 'Ruwais', region: 'إمارة أبوظبي' },
      { name: 'مدينة زايد', nameFr: 'Madinat Zayed', region: 'منطقة الظفرة' },
      { name: 'حتا', nameFr: 'Hatta', region: 'إمارة دبي' },
    ],
  },

  QA: {
    id: 'QA',
    nameAr: 'قطر',
    nameEn: 'Qatar',
    nameFr: 'Qatar',
    flag: '🇶🇦',
    cities: [
      { name: 'الدوحة', nameFr: 'Doha', region: 'بلدية الدوحة', aliases: ['العاصمة'] },
      { name: 'الريان', nameFr: 'Al Rayyan', region: 'بلدية الريان' },
      { name: 'الوكرة', nameFr: 'Al Wakrah', region: 'بلدية الوكرة' },
      { name: 'الخور', nameFr: 'Al Khor', region: 'بلدية الخور والذخيرة' },
      { name: 'أم صلال', nameFr: 'Umm Salal', region: 'بلدية أم صلال' },
      { name: 'الشحانية', nameFr: 'Al Shahaniya', region: 'بلدية الشحانية' },
      { name: 'الشمال', nameFr: 'Madinat ash Shamal', region: 'بلدية الشمال' },
      { name: 'الضعاين', nameFr: 'Al Daayen', region: 'بلدية الضعاين' },
      { name: 'لوسيل', nameFr: 'Lusail', region: 'بلدية الضعاين', aliases: ['مدينة المستقبل'] },
      { name: 'مسيعيد', nameFr: 'Mesaieed', region: 'بلدية الوكرة' },
      { name: 'دخان', nameFr: 'Dukhan', region: 'بلدية الشحانية' },
    ],
  },

  KW: {
    id: 'KW',
    nameAr: 'الكويت',
    nameEn: 'Kuwait',
    nameFr: 'Koweït',
    flag: '🇰🇼',
    cities: [
      { name: 'مدينة الكويت', nameFr: 'Kuwait City', region: 'محافظة العاصمة', aliases: ['الكويت', 'العاصمة'] },
      { name: 'الأحمدي', nameFr: 'Al Ahmadi', region: 'محافظة الأحمدي' },
      { name: 'حولي', nameFr: 'Hawalli', region: 'محافظة حولي' },
      { name: 'الفروانية', nameFr: 'Al Farwaniyah', region: 'محافظة الفروانية' },
      { name: 'الجهراء', nameFr: 'Al Jahra', region: 'محافظة الجهراء' },
      { name: 'مبارك الكبير', nameFr: 'Mubarak Al-Kabeer', region: 'محافظة مبارك الكبير' },
      { name: 'السالمية', nameFr: 'Salmiya', region: 'محافظة حولي' },
      { name: 'الفحيحيل', nameFr: 'Fahaheel', region: 'محافظة الأحمدي' },
      { name: 'صباح الأحمد', nameFr: 'Sabah Al Ahmad', region: 'محافظة الأحمدي' },
      { name: 'خيطان', nameFr: 'Khaitan', region: 'محافظة الفروانية' },
      { name: 'جليب الشيوخ', nameFr: 'Jleeb Al-Shuyoukh', region: 'محافظة الفروانية' },
      { name: 'الشويخ', nameFr: 'Shuwaikh', region: 'محافظة العاصمة' },
    ],
  },

  BH: {
    id: 'BH',
    nameAr: 'البحرين',
    nameEn: 'Bahrain',
    nameFr: 'Bahreïn',
    flag: '🇧🇭',
    cities: [
      { name: 'المنامة', nameFr: 'Manama', region: 'محافظة العاصمة', aliases: ['العاصمة'] },
      { name: 'المحرق', nameFr: 'Muharraq', region: 'محافظة المحرق' },
      { name: 'الرفاع', nameFr: 'Riffa', region: 'المحافظة الجنوبية' },
      { name: 'سترة', nameFr: 'Sitra', region: 'محافظة العاصمة' },
      { name: 'مدينة عيسى', nameFr: 'Isa Town', region: 'المحافظة الجنوبية' },
      { name: 'مدينة حمد', nameFr: 'Hamad Town', region: 'المحافظة الشمالية' },
      { name: 'البديع', nameFr: 'Budaiya', region: 'المحافظة الشمالية' },
      { name: 'جدحفص', nameFr: 'Jidhafs', region: 'المحافظة الشمالية' },
      { name: 'الحد', nameFr: 'Hidd', region: 'محافظة المحرق' },
      { name: 'عالي', nameFr: 'Aali', region: 'المحافظة الشمالية' },
      { name: 'سار', nameFr: 'Saar', region: 'المحافظة الشمالية' },
      { name: 'درة البحرين', nameFr: 'Durrat Al Bahrain', region: 'المحافظة الجنوبية' },
    ],
  },

  OM: {
    id: 'OM',
    nameAr: 'عُمان',
    nameEn: 'Oman',
    nameFr: 'Oman',
    flag: '🇴🇲',
    cities: [
      { name: 'مسقط', nameFr: 'Muscat', region: 'محافظة مسقط', aliases: ['العاصمة'] },
      { name: 'صلالة', nameFr: 'Salalah', region: 'محافظة ظفار', aliases: ['عروس بحر العرب'] },
      { name: 'صحار', nameFr: 'Sohar', region: 'محافظة شمال الباطنة' },
      { name: 'نزوى', nameFr: 'Nizwa', region: 'محافظة الداخلية', aliases: ['بيضة الإسلام'] },
      { name: 'صور', nameFr: 'Sur', region: 'محافظة جنوب الشرقية' },
      { name: 'البريمي', nameFr: 'Al Buraimi', region: 'محافظة البريمي' },
      { name: 'السيب', nameFr: 'Seeb', region: 'محافظة مسقط' },
      { name: 'بوشر', nameFr: 'Bawshar', region: 'محافظة مسقط' },
      { name: 'عبري', nameFr: 'Ibri', region: 'محافظة الظاهرة' },
      { name: 'الرستاق', nameFr: 'Rustaq', region: 'محافظة جنوب الباطنة' },
      { name: 'بهلاء', nameFr: 'Bahla', region: 'محافظة الداخلية' },
      { name: 'إبراء', nameFr: 'Ibra', region: 'محافظة شمال الشرقية' },
      { name: 'بركاء', nameFr: 'Barka', region: 'محافظة جنوب الباطنة' },
      { name: 'خصب', nameFr: 'Khasab', region: 'محافظة مسندم' },
    ],
  },

  JO: {
    id: 'JO',
    nameAr: 'الأردن',
    nameEn: 'Jordan',
    nameFr: 'Jordanie',
    flag: '🇯🇴',
    cities: [
      { name: 'عمّان', nameFr: 'Amman', region: 'محافظة العاصمة', aliases: ['عمان', 'العاصمة', 'فيلادلفيا'] },
      { name: 'الزرقاء', nameFr: 'Zarqa', region: 'محافظة الزرقاء' },
      { name: 'إربد', nameFr: 'Irbid', region: 'محافظة إربد', aliases: ['عروس الشمال'] },
      { name: 'العقبة', nameFr: 'Aqaba', region: 'محافظة العقبة', aliases: ['ثغر الأردن الباسم'] },
      { name: 'السلط', nameFr: 'Salt', region: 'محافظة البلقاء' },
      { name: 'مأدبا', nameFr: 'Madaba', region: 'محافظة مأدبا', aliases: ['مدينة الفسيفساء'] },
      { name: 'جرش', nameFr: 'Jerash', region: 'محافظة جرش', aliases: ['مدينة الألف عمود'] },
      { name: 'عجلون', nameFr: 'Ajloun', region: 'محافظة عجلون' },
      { name: 'المفرق', nameFr: 'Mafraq', region: 'محافظة المفرق' },
      { name: 'الكرك', nameFr: 'Karak', region: 'محافظة الكرك' },
      { name: 'الطفيلة', nameFr: 'Tafilah', region: 'محافظة الطفيلة' },
      { name: 'معان', nameFr: 'Maan', region: 'محافظة معان' },
      { name: 'الرصيفة', nameFr: 'Russeifa', region: 'محافظة الزرقاء' },
      { name: 'وادي موسى (البتراء)', nameFr: 'Wadi Musa', region: 'محافظة معان', aliases: ['البتراء', 'المدينة الوردية'] },
      { name: 'الرمثا', nameFr: 'Ar-Ramtha', region: 'محافظة إربد' },
    ],
  },

  PS: {
    id: 'PS',
    nameAr: 'فلسطين',
    nameEn: 'Palestine',
    nameFr: 'Palestine',
    flag: '🇵🇸',
    cities: [
      { name: 'القدس الشريف', nameFr: 'Jerusalem', region: 'محافظة القدس', aliases: ['القدس', 'زهرة المدائن', 'بيت المقدس'] },
      { name: 'غزة', nameFr: 'Gaza', region: 'محافظة غزة', aliases: ['غزة هاشم'] },
      { name: 'رام الله', nameFr: 'Ramallah', region: 'محافظة رام الله والبيرة' },
      { name: 'البيرة', nameFr: 'Al-Bireh', region: 'محافظة رام الله والبيرة' },
      { name: 'الخليل', nameFr: 'Hebron', region: 'محافظة الخليل', aliases: ['مدينة خليل الرحمن'] },
      { name: 'نابلس', nameFr: 'Nablus', region: 'محافظة نابلس', aliases: ['جبل النار', 'دمشق الصغرى'] },
      { name: 'جنين', nameFr: 'Jenin', region: 'محافظة جنين' },
      { name: 'بيت لحم', nameFr: 'Bethlehem', region: 'محافظة بيت لحم', aliases: ['مهد المسيح'] },
      { name: 'طولكرم', nameFr: 'Tulkarm', region: 'محافظة طولكرم' },
      { name: 'قلقيلية', nameFr: 'Qalqilya', region: 'محافظة قلقيلية' },
      { name: 'أريحا', nameFr: 'Jericho', region: 'محافظة أريحا', aliases: ['أقدم مدينة في العالم'] },
      { name: 'رفح', nameFr: 'Rafah', region: 'محافظة رفح' },
      { name: 'خان يونس', nameFr: 'Khan Yunis', region: 'محافظة خان يونس' },
      { name: 'دير البلح', nameFr: 'Deir al-Balah', region: 'محافظة دير البلح' },
      { name: 'طوباس', nameFr: 'Tubas', region: 'محافظة طوباس' },
      { name: 'سلفيت', nameFr: 'Salfit', region: 'محافظة سلفيت' },
      { name: 'يافا', nameFr: 'Jaffa', region: 'الساحل الفلسطيني', aliases: ['عروس البحر'] },
      { name: 'حيفا', nameFr: 'Haifa', region: 'الساحل الفلسطيني' },
      { name: 'عكا', nameFr: 'Acre', region: 'الجليل' },
      { name: 'الناصرة', nameFr: 'Nazareth', region: 'الجليل' },
    ],
  },

  LB: {
    id: 'LB',
    nameAr: 'لبنان',
    nameEn: 'Lebanon',
    nameFr: 'Liban',
    flag: '🇱🇧',
    cities: [
      { name: 'بيروت', nameFr: 'Beirut', region: 'محافظة بيروت', aliases: ['العاصمة', 'ست الدنيا'] },
      { name: 'طرابلس', nameFr: 'Tripoli', region: 'محافظة الشمال', aliases: ['عاصمة الشمال', 'الفيحاء'] },
      { name: 'صيدا', nameFr: 'Sidon', region: 'محافظة الجنوب', aliases: ['عاصمة الجنوب'] },
      { name: 'صور', nameFr: 'Tyre', region: 'محافظة الجنوب', aliases: ['سيدة البحار'] },
      { name: 'بعلبك', nameFr: 'Baalbek', region: 'محافظة بعلبك الهرمل', aliases: ['مدينة الشمس'] },
      { name: 'زحلة', nameFr: 'Zahlé', region: 'محافظة البقاع', aliases: ['عروس البقاع'] },
      { name: 'النبطية', nameFr: 'Nabatieh', region: 'محافظة النبطية' },
      { name: 'جبيل', nameFr: 'Byblos', region: 'محافظة جبل لبنان', aliases: ['بيبلوس'] },
      { name: 'جونيه', nameFr: 'Jounieh', region: 'محافظة جبل لبنان' },
      { name: 'بعبدا', nameFr: 'Baabda', region: 'محافظة جبل لبنان' },
      { name: 'عاليه', nameFr: 'Aley', region: 'محافظة جبل لبنان' },
      { name: 'بشري', nameFr: 'Bsharri', region: 'محافظة الشمال', aliases: ['مدينة جبران'] },
    ],
  },

  IQ: {
    id: 'IQ',
    nameAr: 'العراق',
    nameEn: 'Iraq',
    nameFr: 'Irak',
    flag: '🇮🇶',
    cities: [
      { name: 'بغداد', nameFr: 'Baghdad', region: 'محافظة بغداد', aliases: ['العاصمة', 'دار السلام', 'مدينة المنصور'] },
      { name: 'البصرة', nameFr: 'Basra', region: 'محافظة البصرة', aliases: ['فينيسيا الشرق', 'ثغر العراق'] },
      { name: 'الموصل', nameFr: 'Mosul', region: 'محافظة نينوى', aliases: ['أم الربيعين', 'الحدباء'] },
      { name: 'أربيل', nameFr: 'Erbil', region: 'إقليم كردستان', aliases: ['هولير'] },
      { name: 'النجف الأشرف', nameFr: 'Najaf', region: 'محافظة النجف', aliases: ['النجف'] },
      { name: 'كربلاء', nameFr: 'Karbala', region: 'محافظة كربلاء' },
      { name: 'السليمانية', nameFr: 'Sulaymaniyah', region: 'إقليم كردستان' },
      { name: 'كركوك', nameFr: 'Kirkuk', region: 'محافظة كركوك' },
      { name: 'الحلة', nameFr: 'Hillah', region: 'محافظة بابل', aliases: ['بابل'] },
      { name: 'الناصرية', nameFr: 'Nasiriyah', region: 'محافظة ذي قار', aliases: ['ذي قار', 'أور'] },
      { name: 'العمارة', nameFr: 'Amarah', region: 'محافظة ميسان' },
      { name: 'الكوت', nameFr: 'Kut', region: 'محافظة واسط' },
      { name: 'الرمادي', nameFr: 'Ramadi', region: 'محافظة الأنبار' },
      { name: 'الفلوجة', nameFr: 'Fallujah', region: 'محافظة الأنبار' },
      { name: 'سامراء', nameFr: 'Samarra', region: 'محافظة صلاح الدين' },
      { name: 'دهوك', nameFr: 'Duhok', region: 'إقليم كردستان' },
      { name: 'الديوانية', nameFr: 'Diwaniyah', region: 'محافظة القادسية' },
      { name: 'بعقوبة', nameFr: 'Baqubah', region: 'محافظة ديالى' },
      { name: 'السماوة', nameFr: 'Samawah', region: 'محافظة المثنى' },
      { name: 'تكريت', nameFr: 'Tikrit', region: 'محافظة صلاح الدين' },
    ],
  },

  SD: {
    id: 'SD',
    nameAr: 'السودان',
    nameEn: 'Sudan',
    nameFr: 'Soudan',
    flag: '🇸🇩',
    cities: [
      { name: 'الخرطوم', nameFr: 'Khartoum', region: 'ولاية الخرطوم', aliases: ['العاصمة المثلثة', 'العاصمة'] },
      { name: 'أم درمان', nameFr: 'Omdurman', region: 'ولاية الخرطوم', aliases: ['العاصمة الوطنية'] },
      { name: 'الخرطوم بحري', nameFr: 'Khartoum North', region: 'ولاية الخرطوم', aliases: ['بحري'] },
      { name: 'بورتسودان', nameFr: 'Port Sudan', region: 'ولاية البحر الأحمر', aliases: ['ثغر السودان'] },
      { name: 'كسلا', nameFr: 'Kassala', region: 'ولاية كسلا' },
      { name: 'الأبيض', nameFr: 'El Obeid', region: 'ولاية شمال كردفان', aliases: ['عروس الرمال'] },
      { name: 'ود مدني', nameFr: 'Wad Madani', region: 'ولاية الجزيرة', aliases: ['سيدة المدائن'] },
      { name: 'الفاشر', nameFr: 'Al-Fashir', region: 'ولاية شمال دارفور' },
      { name: 'القضارف', nameFr: 'Gedarif', region: 'ولاية القضارف' },
      { name: 'نيالا', nameFr: 'Nyala', region: 'ولاية جنوب دارفور' },
      { name: 'عطبرة', nameFr: 'Atbara', region: 'ولاية نهر النيل', aliases: ['مدينة الحديد والنار'] },
      { name: 'كوستي', nameFr: 'Kosti', region: 'ولاية النيل الأبيض' },
      { name: 'الدمازين', nameFr: 'Damazin', region: 'ولاية النيل الأزرق' },
      { name: 'دنقلا', nameFr: 'Dongola', region: 'الولاية الشمالية' },
      { name: 'الجنينة', nameFr: 'Geneina', region: 'ولاية غرب دارفور' },
    ],
  },

  YE: {
    id: 'YE',
    nameAr: 'اليمن',
    nameEn: 'Yemen',
    nameFr: 'Yémen',
    flag: '🇾🇪',
    cities: [
      { name: 'صنعاء', nameFr: "Sana'a", region: 'أمانة العاصمة', aliases: ['صنعاء القديمة', 'العاصمة'] },
      { name: 'عدن', nameFr: 'Aden', region: 'محافظة عدن', aliases: ['العاصمة الاقتصادية', 'عروس بحر العرب'] },
      { name: 'تعز', nameFr: 'Taiz', region: 'محافظة تعز', aliases: ['العاصمة الثقافية'] },
      { name: 'الحديدة', nameFr: 'Hodeidah', region: 'محافظة الحديدة', aliases: ['عروس البحر الأحمر'] },
      { name: 'المكلا', nameFr: 'Mukalla', region: 'محافظة حضرموت', aliases: ['عروس بحر العرب'] },
      { name: 'إب', nameFr: 'Ibb', region: 'محافظة إب', aliases: ['اللواء الأخضر'] },
      { name: 'ذمار', nameFr: 'Dhamar', region: 'محافظة ذمار' },
      { name: 'سيئون', nameFr: 'Seiyun', region: 'محافظة حضرموت' },
      { name: 'صعدة', nameFr: 'Saada', region: 'محافظة صعدة' },
      { name: 'مأرب', nameFr: 'Marib', region: 'محافظة مأرب', aliases: ['مدينة السد', 'مأرب الحضارة'] },
      { name: 'الغيضة', nameFr: 'Al Ghaydah', region: 'محافظة المهرة' },
      { name: 'عتق', nameFr: 'Ataq', region: 'محافظة شبوة' },
      { name: 'زنجبار', nameFr: 'Zinjibar', region: 'محافظة أبين' },
    ],
  },

  FR: {
    id: 'FR',
    nameAr: 'فرنسا',
    nameEn: 'France',
    nameFr: 'France',
    flag: '🇫🇷',
    cities: [
      { name: 'باريس', nameFr: 'Paris', region: 'Île-de-France', aliases: ['عاصمة النور', 'Paris'] },
      { name: 'مارسيليا', nameFr: 'Marseille', region: "Provence-Alpes-Côte d'Azur" },
      { name: 'ليون', nameFr: 'Lyon', region: 'Auvergne-Rhône-Alpes' },
      { name: 'تولوز', nameFr: 'Toulouse', region: 'Occitanie' },
      { name: 'نيس', nameFr: 'Nice', region: "Provence-Alpes-Côte d'Azur" },
      { name: 'نانت', nameFr: 'Nantes', region: 'Pays de la Loire' },
      { name: 'ستراسبورغ', nameFr: 'Strasbourg', region: 'Grand Est' },
      { name: 'مونبلييه', nameFr: 'Montpellier', region: 'Occitanie' },
      { name: 'بوردو', nameFr: 'Bordeaux', region: 'Nouvelle-Aquitaine' },
      { name: 'ليل', nameFr: 'Lille', region: 'Hauts-de-France' },
      { name: 'رين', nameFr: 'Rennes', region: 'Bretagne' },
      { name: 'ريمس', nameFr: 'Reims', region: 'Grand Est' },
      { name: 'تولون', nameFr: 'Toulon', region: "Provence-Alpes-Côte d'Azur" },
      { name: 'سانت إتيان', nameFr: 'Saint-Étienne', region: 'Auvergne-Rhône-Alpes' },
      { name: 'لوهافر', nameFr: 'Le Havre', region: 'Normandie' },
      { name: 'غرونوبل', nameFr: 'Grenoble', region: 'Auvergne-Rhône-Alpes' },
      { name: 'ديجون', nameFr: 'Dijon', region: 'Bourgogne-Franche-Comté' },
      { name: 'آنجيه', nameFr: 'Angers', region: 'Pays de la Loire' },
      { name: 'نيم', nameFr: 'Nîmes', region: 'Occitanie' },
      { name: 'آكس أون بروفانس', nameFr: 'Aix-en-Provence', region: "Provence-Alpes-Côte d'Azur" },
    ],
  },

  ES: {
    id: 'ES',
    nameAr: 'إسبانيا',
    nameEn: 'Spain',
    nameFr: 'Espagne',
    flag: '🇪🇸',
    cities: [
      { name: 'مدريد', nameFr: 'Madrid', region: 'Comunidad de Madrid', aliases: ['العاصمة', 'Madrid'] },
      { name: 'برشلونة', nameFr: 'Barcelona', region: 'Cataluña', aliases: ['Barca'] },
      { name: 'فالنسيا', nameFr: 'Valencia', region: 'Comunidad Valenciana' },
      { name: 'إشبيلية', nameFr: 'Sevilla', region: 'Andalucía', aliases: ['Seville'] },
      { name: 'سرقسطة', nameFr: 'Zaragoza', region: 'Aragón' },
      { name: 'ملقة', nameFr: 'Málaga', region: 'Andalucía', aliases: ['Malaga'] },
      { name: 'مورسيا', nameFr: 'Murcia', region: 'Región de Murcia' },
      { name: 'ميورقة (بالما)', nameFr: 'Palma de Mallorca', region: 'Islas Baleares', aliases: ['بالما'] },
      { name: 'لاس بالماس', nameFr: 'Las Palmas', region: 'Canarias' },
      { name: 'بلباو', nameFr: 'Bilbao', region: 'País Vasco' },
      { name: 'أليكانتي', nameFr: 'Alicante', region: 'Comunidad Valenciana' },
      { name: 'قرطبة', nameFr: 'Córdoba', region: 'Andalucía', aliases: ['Cordoba'] },
      { name: 'بلد الوليد', nameFr: 'Valladolid', region: 'Castilla y León' },
      { name: 'غرناطة', nameFr: 'Granada', region: 'Andalucía', aliases: ['الحمراء'] },
      { name: 'الجزيرة الخضراء', nameFr: 'Algeciras', region: 'Andalucía' },
      { name: 'طليطلة', nameFr: 'Toledo', region: 'Castilla-La Mancha' },
    ],
  },

  IT: {
    id: 'IT',
    nameAr: 'إيطاليا',
    nameEn: 'Italy',
    nameFr: 'Italie',
    flag: '🇮🇹',
    cities: [
      { name: 'روما', nameFr: 'Rome', region: 'Lazio', aliases: ['العاصمة', 'Roma'] },
      { name: 'ميلانو', nameFr: 'Milan', region: 'Lombardia', aliases: ['Milano'] },
      { name: 'نابولي', nameFr: 'Naples', region: 'Campania', aliases: ['Napoli'] },
      { name: 'تورينو', nameFr: 'Turin', region: 'Piemonte' },
      { name: 'باليرمو', nameFr: 'Palermo', region: 'Sicilia' },
      { name: 'جنوة', nameFr: 'Genoa', region: 'Liguria', aliases: ['Genova'] },
      { name: 'بولونيا', nameFr: 'Bologna', region: 'Emilia-Romagna' },
      { name: 'فلورنسا', nameFr: 'Florence', region: 'Toscana', aliases: ['Firenze'] },
      { name: 'باري', nameFr: 'Bari', region: 'Puglia' },
      { name: 'كاتانيا', nameFr: 'Catania', region: 'Sicilia' },
      { name: 'فينيسيا (البندقية)', nameFr: 'Venice', region: 'Veneto', aliases: ['البندقية', 'Venezia'] },
      { name: 'فيرونا', nameFr: 'Verona', region: 'Veneto' },
      { name: 'ميسينا', nameFr: 'Messina', region: 'Sicilia' },
      { name: 'بادوفا', nameFr: 'Padua', region: 'Veneto' },
      { name: 'بريشيا', nameFr: 'Brescia', region: 'Lombardia' },
    ],
  },

  BE: {
    id: 'BE',
    nameAr: 'بلجيكا',
    nameEn: 'Belgium',
    nameFr: 'Belgique',
    flag: '🇧🇪',
    cities: [
      { name: 'بروكسل', nameFr: 'Bruxelles', region: 'Bruxelles-Capitale', aliases: ['Brussels', 'العاصمة'] },
      { name: 'أنتويرب', nameFr: 'Antwerpen', region: 'Vlaanderen', aliases: ['Anvers'] },
      { name: 'غنت', nameFr: 'Gent', region: 'Vlaanderen', aliases: ['Gand'] },
      { name: 'شارلوروا', nameFr: 'Charleroi', region: 'Wallonie' },
      { name: 'لييج', nameFr: 'Liège', region: 'Wallonie' },
      { name: 'بروج', nameFr: 'Brugge', region: 'Vlaanderen', aliases: ['Bruges'] },
      { name: 'نامور', nameFr: 'Namur', region: 'Wallonie' },
      { name: 'لوفان', nameFr: 'Leuven', region: 'Vlaanderen', aliases: ['Louvain'] },
      { name: 'مونس', nameFr: 'Mons', region: 'Wallonie' },
      { name: 'ميشيلين', nameFr: 'Mechelen', region: 'Vlaanderen', aliases: ['Malines'] },
    ],
  },

  DE: {
    id: 'DE',
    nameAr: 'ألمانيا',
    nameEn: 'Germany',
    nameFr: 'Allemagne',
    flag: '🇩🇪',
    cities: [
      { name: 'برلين', nameFr: 'Berlin', region: 'Berlin', aliases: ['العاصمة', 'Berlin'] },
      { name: 'هامبورغ', nameFr: 'Hamburg', region: 'Hamburg' },
      { name: 'ميونخ', nameFr: 'Munich', region: 'Bayern', aliases: ['München'] },
      { name: 'كولونيا', nameFr: 'Cologne', region: 'Nordrhein-Westfalen', aliases: ['Köln'] },
      { name: 'فرانكفورت', nameFr: 'Frankfurt am Main', region: 'Hessen' },
      { name: 'شتوتغارت', nameFr: 'Stuttgart', region: 'Baden-Württemberg' },
      { name: 'دوسلدورف', nameFr: 'Düsseldorf', region: 'Nordrhein-Westfalen' },
      { name: 'لايبزيغ', nameFr: 'Leipzig', region: 'Sachsen' },
      { name: 'دورتموند', nameFr: 'Dortmund', region: 'Nordrhein-Westfalen' },
      { name: 'إسن', nameFr: 'Essen', region: 'Nordrhein-Westfalen' },
      { name: 'بريمن', nameFr: 'Bremen', region: 'Bremen' },
      { name: 'درسدن', nameFr: 'Dresden', region: 'Sachsen' },
      { name: 'هانوفر', nameFr: 'Hannover', region: 'Niedersachsen' },
      { name: 'نورمبرغ', nameFr: 'Nuremberg', region: 'Bayern', aliases: ['Nürnberg'] },
      { name: 'بون', nameFr: 'Bonn', region: 'Nordrhein-Westfalen' },
    ],
  },

  NL: {
    id: 'NL',
    nameAr: 'هولندا',
    nameEn: 'Netherlands',
    nameFr: 'Pays-Bas',
    flag: '🇳🇱',
    cities: [
      { name: 'أمستردام', nameFr: 'Amsterdam', region: 'Noord-Holland', aliases: ['العاصمة'] },
      { name: 'روتردام', nameFr: 'Rotterdam', region: 'Zuid-Holland' },
      { name: 'لاهاي', nameFr: 'The Hague', region: 'Zuid-Holland', aliases: ['Den Haag'] },
      { name: 'أوترخت', nameFr: 'Utrecht', region: 'Utrecht' },
      { name: 'أيندهوفن', nameFr: 'Eindhoven', region: 'Noord-Brabant' },
      { name: 'تيلبورخ', nameFr: 'Tilburg', region: 'Noord-Brabant' },
      { name: 'خرونينغن', nameFr: 'Groningen', region: 'Groningen' },
      { name: 'ألميرا', nameFr: 'Almere', region: 'Flevoland' },
      { name: 'بريدا', nameFr: 'Breda', region: 'Noord-Brabant' },
      { name: 'نايميخن', nameFr: 'Nijmegen', region: 'Gelderland' },
      { name: 'ماستريخت', nameFr: 'Maastricht', region: 'Limburg' },
      { name: 'هارلم', nameFr: 'Haarlem', region: 'Noord-Holland' },
      { name: 'لايدن', nameFr: 'Leiden', region: 'Zuid-Holland' },
    ],
  },

  GB: {
    id: 'GB',
    nameAr: 'المملكة المتحدة',
    nameEn: 'United Kingdom',
    nameFr: 'Royaume-Uni',
    flag: '🇬🇧',
    cities: [
      { name: 'لندن', nameFr: 'London', region: 'Greater London', aliases: ['العاصمة', 'بريطانيا'] },
      { name: 'برمنغهام', nameFr: 'Birmingham', region: 'West Midlands' },
      { name: 'مانشستر', nameFr: 'Manchester', region: 'Greater Manchester' },
      { name: 'غلاسكو', nameFr: 'Glasgow', region: 'Scotland' },
      { name: 'ليدز', nameFr: 'Leeds', region: 'West Yorkshire' },
      { name: 'ليفربول', nameFr: 'Liverpool', region: 'Merseyside' },
      { name: 'نيوكاسل', nameFr: 'Newcastle upon Tyne', region: 'Tyne and Wear' },
      { name: 'شفيلد', nameFr: 'Sheffield', region: 'South Yorkshire' },
      { name: 'بريستول', nameFr: 'Bristol', region: 'South West England' },
      { name: 'إدنبرة', nameFr: 'Edinburgh', region: 'Scotland' },
      { name: 'بلفاست', nameFr: 'Belfast', region: 'Northern Ireland' },
      { name: 'كارديف', nameFr: 'Cardiff', region: 'Wales' },
      { name: 'نوتنغهام', nameFr: 'Nottingham', region: 'East Midlands' },
      { name: 'أكسفورد', nameFr: 'Oxford', region: 'South East England' },
      { name: 'كامبريدج', nameFr: 'Cambridge', region: 'East of England' },
    ],
  },

  US: {
    id: 'US',
    nameAr: 'الولايات المتحدة',
    nameEn: 'United States',
    nameFr: 'États-Unis',
    flag: '🇺🇸',
    cities: [
      { name: 'واشنطن العاصمة', nameFr: 'Washington D.C.', region: 'District of Columbia', aliases: ['واشنطن', 'العاصمة'] },
      { name: 'نيويورك', nameFr: 'New York City', region: 'New York', aliases: ['NYC', 'منهاتن'] },
      { name: 'لوس أنجلوس', nameFr: 'Los Angeles', region: 'California', aliases: ['LA', 'هوليوود'] },
      { name: 'شيكاغو', nameFr: 'Chicago', region: 'Illinois', aliases: ['مدينة الرياح'] },
      { name: 'هيوستن', nameFr: 'Houston', region: 'Texas' },
      { name: 'فينيكس', nameFr: 'Phoenix', region: 'Arizona' },
      { name: 'فيلادلفيا', nameFr: 'Philadelphia', region: 'Pennsylvania' },
      { name: 'سان أنطونيو', nameFr: 'San Antonio', region: 'Texas' },
      { name: 'سان دييغو', nameFr: 'San Diego', region: 'California' },
      { name: 'دالاس', nameFr: 'Dallas', region: 'Texas' },
      { name: 'أوستن', nameFr: 'Austin', region: 'Texas' },
      { name: 'سان فرانسيسكو', nameFr: 'San Francisco', region: 'California', aliases: ['SF', 'السيليكون فالي'] },
      { name: 'سياتل', nameFr: 'Seattle', region: 'Washington' },
      { name: 'دنفر', nameFr: 'Denver', region: 'Colorado' },
      { name: 'بوسطن', nameFr: 'Boston', region: 'Massachusetts' },
      { name: 'ميامي', nameFr: 'Miami', region: 'Florida' },
      { name: 'أتلانتا', nameFr: 'Atlanta', region: 'Georgia' },
      { name: 'لاس فيغاس', nameFr: 'Las Vegas', region: 'Nevada' },
      { name: 'أورلاندو', nameFr: 'Orlando', region: 'Florida' },
    ],
  },

  CA: {
    id: 'CA',
    nameAr: 'كندا',
    nameEn: 'Canada',
    nameFr: 'Canada',
    flag: '🇨🇦',
    cities: [
      { name: 'أوتاوا', nameFr: 'Ottawa', region: 'Ontario', aliases: ['العاصمة'] },
      { name: 'تورونتو', nameFr: 'Toronto', region: 'Ontario' },
      { name: 'مونتريال', nameFr: 'Montréal', region: 'Québec' },
      { name: 'فانكوفر', nameFr: 'Vancouver', region: 'British Columbia' },
      { name: 'كالغاري', nameFr: 'Calgary', region: 'Alberta' },
      { name: 'إدمونتون', nameFr: 'Edmonton', region: 'Alberta' },
      { name: 'كيبك سيتي', nameFr: 'Québec City', region: 'Québec' },
      { name: 'وينيبيغ', nameFr: 'Winnipeg', region: 'Manitoba' },
      { name: 'هاميلتون', nameFr: 'Hamilton', region: 'Ontario' },
      { name: 'هاليفاكس', nameFr: 'Halifax', region: 'Nova Scotia' },
      { name: 'فيكتوريا', nameFr: 'Victoria', region: 'British Columbia' },
    ],
  },

  TR: {
    id: 'TR',
    nameAr: 'تركيا',
    nameEn: 'Turkey',
    nameFr: 'Turquie',
    flag: '🇹🇷',
    cities: [
      { name: 'أنقرة', nameFr: 'Ankara', region: 'İç Anadolu', aliases: ['العاصمة'] },
      { name: 'إسطنبول', nameFr: 'Istanbul', region: 'Marmara', aliases: ['القسطنطينية', 'اسطنبول'] },
      { name: 'إزمير', nameFr: 'Izmir', region: 'Ege' },
      { name: 'بورصة', nameFr: 'Bursa', region: 'Marmara' },
      { name: 'أنطاليا', nameFr: 'Antalya', region: 'Akdeniz' },
      { name: 'أضنة', nameFr: 'Adana', region: 'Akdeniz' },
      { name: 'ق Konya', nameFr: 'Konya', region: 'İç Anadolu', aliases: ['قونية'] },
      { name: 'غازي عنتاب', nameFr: 'Gaziantep', region: 'Güneydoğu Anadolu' },
      { name: 'مرسين', nameFr: 'Mersin', region: 'Akdeniz' },
      { name: 'ديار بكر', nameFr: 'Diyarbakır', region: 'Güneydoğu Anadolu' },
      { name: 'طرابزون', nameFr: 'Trabzon', region: 'Karadeniz' },
      { name: 'سامسون', nameFr: 'Samsun', region: 'Karadeniz' },
      { name: 'يلوا', nameFr: 'Yalova', region: 'Marmara' },
    ],
  },

  CH: {
    id: 'CH',
    nameAr: 'سويسرا',
    nameEn: 'Switzerland',
    nameFr: 'Suisse',
    flag: '🇨🇭',
    cities: [
      { name: 'برن', nameFr: 'Berne', region: 'Canton de Berne', aliases: ['العاصمة', 'Bern'] },
      { name: 'زيورخ', nameFr: 'Zurich', region: 'Canton de Zurich', aliases: ['Zürich'] },
      { name: 'جنيف', nameFr: 'Genève', region: 'Canton de Genève', aliases: ['Geneva'] },
      { name: 'بازل', nameFr: 'Bâle', region: 'Bâle-Ville', aliases: ['Basel'] },
      { name: 'لوزان', nameFr: 'Lausanne', region: 'Vaud' },
      { name: 'لوسرن', nameFr: 'Lucerne', region: 'Lucerne' },
      { name: 'سانت غالن', nameFr: 'Saint-Gall', region: 'Saint-Gall' },
      { name: 'لوغانو', nameFr: 'Lugano', region: 'Tessin' },
      { name: 'فينترتور', nameFr: 'Winterthour', region: 'Canton de Zurich' },
      { name: 'فريبورغ', nameFr: 'Fribourg', region: 'Fribourg' },
    ],
  },

  SE: {
    id: 'SE',
    nameAr: 'السويد',
    nameEn: 'Sweden',
    nameFr: 'Suède',
    flag: '🇸🇪',
    cities: [
      { name: 'ستوكهولم', nameFr: 'Stockholm', region: 'Stockholms län', aliases: ['العاصمة'] },
      { name: 'غوتنبرغ', nameFr: 'Göteborg', region: 'Västra Götalands län', aliases: ['Gothenburg'] },
      { name: 'مالمو', nameFr: 'Malmö', region: 'Skåne län' },
      { name: 'أوبسالا', nameFr: 'Uppsala', region: 'Uppsala län' },
      { name: 'لينشوبينغ', nameFr: 'Linköping', region: 'Östergötlands län' },
      { name: 'أوريبرو', nameFr: 'Örebro', region: 'Örebro län' },
      { name: 'فاستيراس', nameFr: 'Västerås', region: 'Västmanlands län' },
      { name: 'هلسينغبورغ', nameFr: 'Helsingborg', region: 'Skåne län' },
      { name: 'يونشوبينغ', nameFr: 'Jönköping', region: 'Jönköpings län' },
      { name: 'لوند', nameFr: 'Lund', region: 'Skåne län' },
    ],
  },
};

/**
 * Normalizes text for robust searching and comparison
 */
export function normalizeGeoText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove Arabic diacritics
    .replace(/[-_.]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Resolves a CountryGeoData object from various representations (nameAr, nameEn, nameFr, ISO id)
 */
export function resolveCountryGeoData(countryNameOrCode: string): CountryGeoData | null {
  if (!countryNameOrCode) return GEO_DATABASE['MA'];
  const clean = normalizeGeoText(countryNameOrCode);
  
  // 1. Direct match on code
  const upper = countryNameOrCode.trim().toUpperCase();
  if (GEO_DATABASE[upper]) {
    return GEO_DATABASE[upper];
  }

  // 2. Iterate through all countries
  for (const country of Object.values(GEO_DATABASE)) {
    if (
      normalizeGeoText(country.nameAr) === clean ||
      normalizeGeoText(country.nameEn) === clean ||
      normalizeGeoText(country.nameFr) === clean ||
      country.id.toLowerCase() === countryNameOrCode.trim().toLowerCase()
    ) {
      return country;
    }
  }

  // 3. Partial or keyword matching (e.g. "المملكة المغربية" -> "المغرب", "المملكة العربية السعودية" -> "السعودية")
  for (const country of Object.values(GEO_DATABASE)) {
    const normAr = normalizeGeoText(country.nameAr);
    if (clean.includes(normAr) || normAr.includes(clean)) {
      return country;
    }
  }

  return null;
}

/**
 * Returns the list of cities for a given country
 */
export function getCitiesForCountry(countryNameOrCode: string): CityInfo[] {
  const geo = resolveCountryGeoData(countryNameOrCode);
  if (!geo) return [];
  return geo.cities;
}

/**
 * Returns plain city name strings for a country
 */
export function getCityNamesForCountry(countryNameOrCode: string): string[] {
  return getCitiesForCountry(countryNameOrCode).map(c => c.name);
}

/**
 * Strict validator: Checks if a city strictly belongs to the specified country
 */
export function isCityValidForCountry(cityName: string, countryNameOrCode: string): boolean {
  if (!cityName || !cityName.trim()) return false;
  const cities = getCitiesForCountry(countryNameOrCode);
  if (cities.length === 0) {
    // If country is not in database, accept non-empty string as fallback
    return cityName.trim().length >= 2;
  }
  const cleanCity = normalizeGeoText(cityName);
  return cities.some(c => {
    if (normalizeGeoText(c.name) === cleanCity) return true;
    if (c.nameFr && normalizeGeoText(c.nameFr) === cleanCity) return true;
    if (c.aliases && c.aliases.some(a => normalizeGeoText(a) === cleanCity)) return true;
    return false;
  });
}

/**
 * Filters cities within a country based on user search query (Arabic or Latin, aliases)
 */
export function searchCitiesInCountry(countryNameOrCode: string, query: string): CityInfo[] {
  const cities = getCitiesForCountry(countryNameOrCode);
  const cleanQuery = normalizeGeoText(query);
  if (!cleanQuery) return cities;

  return cities.filter(city => {
    if (normalizeGeoText(city.name).includes(cleanQuery)) return true;
    if (city.nameFr && normalizeGeoText(city.nameFr).includes(cleanQuery)) return true;
    if (city.region && normalizeGeoText(city.region).includes(cleanQuery)) return true;
    if (city.aliases && city.aliases.some(a => normalizeGeoText(a).includes(cleanQuery))) return true;
    return false;
  });
}
