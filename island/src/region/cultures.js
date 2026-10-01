// The people of a place, as the regional kit sees them: whose names they carry, the mix of
// ancestry the body system blends (African, Asian, European targets of the base mesh, which
// between them cover everyone, in proportions), what is customary to wear on the head and
// for the day, the places of worship and the sound of them, and the language the greeting
// is in. Chosen from the atlas region's id (the most particular rule that matches wins).
//
// These are plain, everyday facts about places, kept to what most people there would
// recognise. Everyone is a person first: a name, a job, a temperament (persona.js); nothing
// here is meant as a type to be played.

// given names (m, f) and family names, by culture; real and common
export const NAMES = {
	inuit: { m: ['Aputi', 'Jaypeetee', 'Pauloosie', 'Simeonie', 'Tagak', 'Joanasie', 'Malachi', 'Nuka'], f: ['Ataguttaaluk', 'Kunuk', 'Leetia', 'Malaya', 'Naja', 'Pitsiulak', 'Siila', 'Ulaayu'], s: ['Akeeagok', 'Kilabuk', 'Nashook', 'Ootoova', 'Qaunaq', 'Arnatsiaq', 'Pootoogook'] },
	kalaallit: { m: ['Aqqaluk', 'Hans', 'Ivik', 'Kristian', 'Malik', 'Nuka', 'Pavia', 'Ole'], f: ['Aviaja', 'Ivalu', 'Naja', 'Paninnguaq', 'Nivi', 'Sara', 'Arnaq', 'Ane'], s: ['Kleist', 'Lynge', 'Petersen', 'Olsen', 'Berthelsen', 'Kristiansen', 'Motzfeldt'] },
	inupiat: { m: ['Aaron', 'Ahmaogak', 'Frank', 'Isaac', 'Joe', 'Roy', 'Taqulik'], f: ['Angela', 'Doreen', 'Ida', 'Martha', 'Rachel', 'Qaiyaan', 'Sarah'], s: ['Ahmaogak', 'Brower', 'Hopson', 'Itta', 'Leavitt', 'Nageak', 'Rexford'] },
	nordic: { m: ['Lars', 'Erik', 'Ole', 'Jonas', 'Mats', 'Henrik', 'Sindre', 'Aksel', 'Mikko', 'Juha'], f: ['Ingrid', 'Kari', 'Sofie', 'Astrid', 'Maja', 'Linnea', 'Elina', 'Aino', 'Silje'], s: ['Hansen', 'Johansen', 'Nilsen', 'Berg', 'Lindqvist', 'Virtanen', 'Korhonen', 'Andersen', 'Eriksson'] },
	sami: { m: ['Ánde', 'Mikkel', 'Niillas', 'Johan', 'Aslak', 'Nils'], f: ['Elle', 'Ristin', 'Máret', 'Inger', 'Ánne', 'Sara'], s: ['Gaup', 'Somby', 'Eira', 'Sara', 'Hætta', 'Buljo'] },
	russian: { m: ['Aleksei', 'Dmitri', 'Ivan', 'Sergei', 'Nikolai', 'Pavel', 'Andrei', 'Yuri'], f: ['Anna', 'Olga', 'Natalia', 'Svetlana', 'Irina', 'Yelena', 'Tatiana', 'Daria'], s: ['Ivanov', 'Petrov', 'Smirnov', 'Kuznetsov', 'Popov', 'Sokolov', 'Volkov'] },
	sakha: { m: ['Aisen', 'Ayaal', 'Erchim', 'Nyurgun', 'Tuyaara', 'Vasili', 'Semyon'], f: ['Sardaana', 'Kyunney', 'Aitalina', 'Nyurguyana', 'Tuyara', 'Maria'], s: ['Nikolaev', 'Egorov', 'Vinokurov', 'Ammosov', 'Okoneshnikov', 'Sivtsev'] },
	nenets: { m: ['Vasili', 'Ilya', 'Yakov', 'Sergei', 'Pyotr'], f: ['Maria', 'Galina', 'Olga', 'Nadezhda', 'Anna'], s: ['Khudi', 'Serotetto', 'Laptander', 'Okotetto', 'Vanuito'] },
	arab: { m: ['Ahmad', 'Omar', 'Yusuf', 'Khalid', 'Hassan', 'Karim', 'Tariq', 'Samir', 'Ibrahim', 'Faisal'], f: ['Fatima', 'Layla', 'Amira', 'Noor', 'Mariam', 'Huda', 'Rania', 'Salma', 'Yasmin', 'Aisha'], s: ['Haddad', 'Khoury', 'Al-Sayed', 'Nasser', 'Mansour', 'Saleh', 'Hamdan', 'Darwish', 'Aziz'] },
	maghreb: { m: ['Youssef', 'Mohamed', 'Hamid', 'Rachid', 'Karim', 'Amine', 'Idir', 'Said'], f: ['Fatima Zahra', 'Khadija', 'Salma', 'Imane', 'Nadia', 'Tiziri', 'Amal', 'Houda'], s: ['El Idrissi', 'Benali', 'Amrani', 'Bennani', 'Ait Ali', 'Tazi', 'Ouali', 'Haddou'] },
	tuareg: { m: ['Ghali', 'Mohamed', 'Ibrahim', 'Amastan', 'Assalek', 'Moussa'], f: ['Tinhinan', 'Fatimata', 'Takamat', 'Aminatou', 'Mariama'], s: ['Ag Alhassane', 'Ag Ghali', 'Ag Mohamed'], sf: ['Walet Ibrahim', 'Walet Alhassane', 'Walet Mohamed'] },
	persian: { m: ['Reza', 'Ali', 'Amir', 'Hossein', 'Mehdi', 'Dariush', 'Kaveh', 'Babak'], f: ['Maryam', 'Shirin', 'Leila', 'Parisa', 'Neda', 'Sara', 'Azadeh', 'Roya'], s: ['Ahmadi', 'Hosseini', 'Karimi', 'Rezaei', 'Tehrani', 'Moradi', 'Jafari', 'Sadeghi'] },
	turkish: { m: ['Mehmet', 'Mustafa', 'Emre', 'Can', 'Burak', 'Ahmet', 'Murat', 'Kemal'], f: ['Elif', 'Zeynep', 'Ayşe', 'Fatma', 'Emine', 'Selin', 'Deniz', 'Merve'], s: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk'] },
	caucasus: { m: ['Giorgi', 'Levan', 'Davit', 'Aram', 'Tigran', 'Elnur', 'Nika'], f: ['Nino', 'Tamar', 'Mariam', 'Anahit', 'Lilit', 'Aygun', 'Salome'], s: ['Beridze', 'Kapanadze', 'Gelashvili', 'Petrosyan', 'Hakobyan', 'Mammadov', 'Aliyev'] },
	central: { m: ['Timur', 'Rustam', 'Dilshod', 'Aibek', 'Nurlan', 'Bakhyt', 'Jasur', 'Erlan'], f: ['Dilnoza', 'Aigerim', 'Madina', 'Zarina', 'Gulnara', 'Aizhan', 'Nilufar'], s: ['Karimov', 'Abdullaev', 'Nurlanov', 'Seitkali', 'Usmonov', 'Bekov', 'Tursunov'] },
	mongol: { m: ['Bat-Erdene', 'Ganbold', 'Temuulen', 'Bold', 'Enkhbayar', 'Sükhbaatar', 'Tömör'], f: ['Oyunchimeg', 'Sarnai', 'Altantsetseg', 'Enkhjargal', 'Narantuya', 'Bolormaa'], s: ['Batbayar', 'Gantulga', 'Dorj', 'Erdene', 'Tsogt', 'Bayar'] },
	tibetan: { m: ['Tenzin', 'Tashi', 'Dorje', 'Norbu', 'Sonam', 'Karma', 'Pema'], f: ['Dolma', 'Pema', 'Yangchen', 'Dechen', 'Lhamo', 'Sonam', 'Tsering'], s: ['Tsering', 'Wangchuk', 'Gyatso', 'Namgyal', 'Dorje', 'Phuntsok'] },
	nepali: { m: ['Bikash', 'Pasang', 'Ram', 'Suresh', 'Ang', 'Mingma', 'Hari'], f: ['Sita', 'Laxmi', 'Pasang', 'Sunita', 'Maya', 'Dawa', 'Anita'], s: ['Sherpa', 'Gurung', 'Tamang', 'Shrestha', 'Thapa', 'Rai', 'Magar'] },
	southasia: { m: ['Arjun', 'Rahul', 'Vikram', 'Imran', 'Rohan', 'Sanjay', 'Harpreet', 'Anil', 'Farhan', 'Karthik'], f: ['Priya', 'Ananya', 'Sunita', 'Fatima', 'Lakshmi', 'Meera', 'Kavya', 'Ayesha', 'Deepa', 'Simran'], s: ['Sharma', 'Patel', 'Kumar', 'Das'],
		// given and family names go together within a community
		g: [
			{ w: 5, m: ['Arjun', 'Rahul', 'Vikram', 'Rohan', 'Sanjay', 'Anil'], f: ['Priya', 'Ananya', 'Sunita', 'Meera', 'Deepa', 'Pooja'], s: ['Sharma', 'Patel', 'Kumar', 'Das', 'Gupta', 'Verma'] },
			{ w: 2, m: ['Karthik', 'Suresh', 'Venkat', 'Arun'], f: ['Lakshmi', 'Kavya', 'Divya', 'Anjali'], s: ['Iyer', 'Reddy', 'Nair', 'Pillai'] },
			{ w: 2, m: ['Imran', 'Farhan', 'Salman', 'Arif'], f: ['Fatima', 'Ayesha', 'Zainab', 'Sana'], s: ['Khan', 'Qureshi', 'Ansari', 'Siddiqui'] },
			{ w: 1, m: ['Harpreet', 'Gurdeep', 'Manpreet', 'Jasbir'], f: ['Simran', 'Harleen', 'Jaspreet', 'Gurleen'], s: ['Singh', 'Gill', 'Sandhu'], sf: ['Kaur', 'Gill', 'Sandhu'] },
		] },
	chinese: { m: ['Wei', 'Jun', 'Hao', 'Lei', 'Ming', 'Jian', 'Tao', 'Yong', 'Bo'], f: ['Mei', 'Li', 'Xiu', 'Fang', 'Jing', 'Yan', 'Hui', 'Lan', 'Xin'], s: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou'] },
	japanese: { m: ['Haruto', 'Takeshi', 'Kenji', 'Hiroshi', 'Daiki', 'Sota', 'Ren', 'Yuto'], f: ['Yui', 'Aoi', 'Sakura', 'Haruka', 'Mei', 'Yuki', 'Rin', 'Emi'], s: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura'] },
	korean: { m: ['Min-jun', 'Seo-jun', 'Ji-ho', 'Hyun-woo', 'Dong-hyun', 'Jae-won'], f: ['Seo-yeon', 'Ji-woo', 'Min-seo', 'Su-bin', 'Ha-eun', 'Ye-jin'], s: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon'] },
	vietnamese: { m: ['Minh', 'Tuấn', 'Hùng', 'Đức', 'Long', 'Nam', 'Quang'], f: ['Lan', 'Hoa', 'Linh', 'Mai', 'Thảo', 'Ngọc', 'Hương'], s: ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng'] },
	thai: { m: ['Somchai', 'Anan', 'Krit', 'Niran', 'Pichai', 'Thanawat'], f: ['Malee', 'Siriporn', 'Nok', 'Ploy', 'Kanya', 'Pim'], s: ['Saetang', 'Wongsa', 'Srisuk', 'Chaiyaporn', 'Boonmee', 'Thongchai'] },
	malay: { m: ['Ahmad', 'Hafiz', 'Budi', 'Agus', 'Rizal', 'Wayan', 'Made', 'Joko'], f: ['Siti', 'Nurul', 'Dewi', 'Putri', 'Ayu', 'Ketut', 'Sri', 'Intan'], s: ['Santoso', 'Wijaya', 'Hidayat', 'Saputra', 'Pratama'],
		g: [
			{ w: 3, m: ['Ahmad', 'Hafiz', 'Rizal', 'Faiz'], f: ['Siti', 'Nurul', 'Aisyah', 'Intan'], s: ['bin Ahmad', 'bin Ismail', 'bin Yusof'], sf: ['binti Ahmad', 'binti Ismail', 'binti Yusof'] },
			{ w: 4, m: ['Budi', 'Agus', 'Joko', 'Eko'], f: ['Dewi', 'Putri', 'Sri', 'Rina'], s: ['Santoso', 'Wijaya', 'Hidayat', 'Saputra', 'Pratama'] },
			{ w: 1, m: ['Wayan', 'Made', 'Nyoman'], f: ['Ayu', 'Ketut', 'Komang'], s: ['Sudarta', 'Suarjana', 'Wirawan', 'Arsana'] },
		] },
	dayak: { m: ['Jimbun', 'Langgi', 'Ngumbang', 'Unggang', 'Ricky', 'Nyipa'], f: ['Sindai', 'Inggai', 'Rapi', 'Mary', 'Dayang', 'Lulong'], s: ['anak Jimbun', 'anak Langgi', 'Unting', 'Ngau', 'Sigat'] },
	filipino: { m: ['Jose', 'Mark', 'Juan', 'Paolo', 'Rogelio', 'Jun'], f: ['Maria', 'Grace', 'Angelica', 'Joy', 'Rowena', 'Liza'], s: ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia'] },
	burmese: { m: ['Aung', 'Kyaw', 'Min', 'Zaw', 'Htet', 'Thant'], f: ['Su', 'Thandar', 'Hnin', 'Ei', 'Myat', 'Khin'], s: ['Aung', 'Win', 'Myint', 'Oo', 'Htun', 'Thein'] },
	swahili: { m: ['Juma', 'Baraka', 'Omari', 'Joseph', 'Daudi', 'Kamau', 'Otieno', 'Wanjiru'], f: ['Amina', 'Neema', 'Zawadi', 'Grace', 'Wanjiku', 'Akinyi', 'Rehema', 'Halima'], s: ['Mwangi', 'Odhiambo', 'Kamau', 'Otieno', 'Mohamed', 'Njoroge', 'Mushi', 'Mbwana'] },
	maasai: { m: ['Lekishon', 'Saitoti', 'Kenta', 'Lemayian', 'Parsimei'], f: ['Naserian', 'Nashipae', 'Nalangu', 'Resian', 'Nalotuesha'], s: ['Ole Sankale', 'Ole Ntimama', 'Ole Kisio', 'Ole Pere'], sf: ['Sankale', 'Ntimama', 'Kisio', 'Pere'] },
	westafrica: { m: ['Kwame', 'Kofi', 'Chinedu', 'Emeka', 'Tunde', 'Musa', 'Abdoulaye', 'Moussa', 'Seydou'], f: ['Ama', 'Abena', 'Ngozi', 'Chiamaka', 'Folake', 'Aminata', 'Fatoumata', 'Awa', 'Adjoa'], s: ['Mensah', 'Okafor', 'Adeyemi', 'Diallo', 'Traoré', 'Ndiaye', 'Boateng', 'Okeke', 'Coulibaly'] },
	mande: { m: ['Moussa', 'Seydou', 'Bakary', 'Mamadou', 'Oumar', 'Souleymane', 'Ibrahim'], f: ['Aminata', 'Fatoumata', 'Awa', 'Mariam', 'Kadiatou', 'Assitan', 'Oumou'], s: ['Traoré', 'Coulibaly', 'Diarra', 'Keïta', 'Konaté', 'Sangaré', 'Touré', 'Cissé'] },
	akan: { m: ['Kwame', 'Kofi', 'Kwaku', 'Yaw', 'Kwabena', 'Kojo'], f: ['Ama', 'Abena', 'Akosua', 'Adjoa', 'Efua', 'Yaa'], s: ['Mensah', 'Boateng', 'Owusu', 'Asante', 'Agyeman', 'Ofori'] },
	nigeria: { m: ['Chinedu', 'Emeka', 'Tunde', 'Segun', 'Obinna', 'Femi'], f: ['Ngozi', 'Chiamaka', 'Folake', 'Funmilayo', 'Adaeze', 'Bisi'], s: ['Okafor', 'Adeyemi', 'Okeke', 'Balogun', 'Eze', 'Adebayo'] },
	hausa: { m: ['Musa', 'Abubakar', 'Sani', 'Usman', 'Aliyu', 'Ibrahim'], f: ['Aisha', 'Zainab', 'Hauwa', 'Amina', 'Hadiza', 'Fatima'], s: ['Bello', 'Abdullahi', 'Garba', 'Yusuf', 'Danjuma', 'Lawal'] },
	wolof: { m: ['Mamadou', 'Cheikh', 'Ousmane', 'Ibrahima', 'Modou', 'Lamine'], f: ['Awa', 'Fatou', 'Aïssatou', 'Khady', 'Ndeye', 'Coumba'], s: ['Ndiaye', 'Diop', 'Fall', 'Sow', 'Gueye', 'Sarr'] },
	horn: { m: ['Abebe', 'Dawit', 'Tesfaye', 'Yonas', 'Mohamed', 'Abdi', 'Mulugeta'], f: ['Selam', 'Hiwot', 'Tigist', 'Meron', 'Hodan', 'Fartun', 'Bethlehem'], s: ['Bekele', 'Tadesse', 'Haile', 'Girma', 'Warsame', 'Hussein'] },
	southernafrica: { m: ['Sipho', 'Thabo', 'Themba', 'Lwazi', 'Tatenda', 'Kagiso', 'Bongani'], f: ['Nomvula', 'Thandiwe', 'Lerato', 'Zanele', 'Rutendo', 'Naledi', 'Ayanda'], s: ['Dlamini', 'Nkosi', 'Mokoena', 'Ndlovu', 'Khumalo', 'Moyo', 'Sithole'] },
	congo: { m: ['Jean-Pierre', 'Patrice', 'Didier', 'Mbuyi', 'Kabasele', 'Fiston'], f: ['Mireille', 'Ange', 'Grâce', 'Nsimba', 'Mbombo', 'Esther'], s: ['Kabila', 'Mbuyi', 'Ilunga', 'Kasongo', 'Lukusa', 'Tshibanda'] },
	malagasy: { m: ['Hery', 'Rivo', 'Fidy', 'Tiana', 'Andry'], f: ['Voahirana', 'Lalaina', 'Noro', 'Hanitra', 'Fara'], s: ['Rakoto', 'Rasoa', 'Randria', 'Razafy', 'Andrianina'] },
	spanish: { m: ['Javier', 'Carlos', 'Pablo', 'Miguel', 'Diego', 'Andrés', 'Luis', 'Mateo'], f: ['Lucía', 'Carmen', 'María', 'Sofía', 'Elena', 'Paula', 'Isabel', 'Valentina'], s: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Torres', 'Ruiz'] },
	andean: { m: ['Wilfredo', 'Jhon', 'Edwin', 'Florencio', 'Rubén', 'Kusi', 'Teodoro'], f: ['Rosa', 'Yolanda', 'Nilda', 'Sisa', 'Juana', 'Killa', 'Marleny'], s: ['Mamani', 'Quispe', 'Condori', 'Huamán', 'Ccama', 'Apaza', 'Choque'] },
	brazil: { m: ['João', 'Pedro', 'Lucas', 'Rafael', 'Thiago', 'Gabriel', 'Mateus'], f: ['Ana', 'Juliana', 'Camila', 'Beatriz', 'Larissa', 'Fernanda', 'Mariana'], s: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Ferreira'] },
	amazon: { m: ['Raoni', 'Davi', 'Ailton', 'Benki', 'Kayan', 'Marcos'], f: ['Sônia', 'Tainá', 'Yara', 'Alessandra', 'Iracema', 'Jaci'], s: ['Guajajara', 'Ashaninka', 'Munduruku', 'Krenak', 'Terena', 'Baniwa'] },
	portuguese: { m: ['João', 'Miguel', 'Tiago', 'Rui', 'Duarte'], f: ['Inês', 'Beatriz', 'Mariana', 'Leonor', 'Joana'], s: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa'] },
	french: { m: ['Louis', 'Hugo', 'Julien', 'Thomas', 'Pierre', 'Antoine'], f: ['Camille', 'Léa', 'Manon', 'Chloé', 'Inès', 'Juliette'], s: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Lefèvre'] },
	german: { m: ['Lukas', 'Jonas', 'Felix', 'Matthias', 'Stefan', 'Andreas'], f: ['Lena', 'Anna', 'Sophie', 'Katharina', 'Julia', 'Hannah'], s: ['Müller', 'Schmidt', 'Huber', 'Gruber', 'Wagner', 'Bauer', 'Hofer'] },
	italian: { m: ['Marco', 'Luca', 'Giuseppe', 'Francesco', 'Matteo', 'Alessandro'], f: ['Giulia', 'Chiara', 'Francesca', 'Sofia', 'Martina', 'Elena'], s: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Ricci'] },
	greek: { m: ['Giorgos', 'Nikos', 'Dimitris', 'Yannis', 'Kostas'], f: ['Maria', 'Eleni', 'Katerina', 'Sofia', 'Despina'], s: ['Papadopoulos', 'Georgiou', 'Nikolaidis', 'Dimitriou', 'Vlachos'] },
	balkan: { m: ['Marko', 'Luka', 'Ivan', 'Nikola', 'Stefan', 'Arben'], f: ['Ana', 'Milica', 'Jelena', 'Ivana', 'Elira', 'Maja'], s: ['Horvat', 'Kovačević', 'Petrović', 'Jovanović', 'Hoxha', 'Babić'] },
	slavic: { m: ['Piotr', 'Tomáš', 'Jakub', 'Oleksandr', 'Andrii', 'Mihai'], f: ['Anna', 'Katarzyna', 'Petra', 'Olena', 'Ioana', 'Zofia'], s: ['Nowak', 'Kowalski', 'Novák', 'Shevchenko', 'Popescu', 'Horváth'] },
	british: { m: ['James', 'Tom', 'Callum', 'Owen', 'Rhys', 'Liam', 'Ewan'], f: ['Emily', 'Sophie', 'Niamh', 'Isla', 'Megan', 'Siobhan', 'Ffion'], s: ['Smith', 'Jones', 'Williams', 'Taylor', 'Murphy', 'MacDonald', 'Evans'] },
	polynesian: { m: ['Sione', 'Tama', 'Mana', 'Ioane', 'Vaea', 'Lui'], f: ['Mele', 'Hina', 'Losa', 'Moana', 'Vai', 'Leilani'], s: ['Tupou', 'Faleolo', 'Tetuanui', 'Taufa', 'Vaipulu', 'Aumua'] },
	melanesian: { m: ['Peni', 'Joseph', 'Kila', 'Michael', 'Wari', 'Tomas'], f: ['Mary', 'Grace', 'Rose', 'Kila', 'Lucy', 'Margaret'], s: ['Kila', 'Wari', 'Somare', 'Namaliu', 'Tau', 'Kumul'] },
	maori: { m: ['Wiremu', 'Tama', 'Rawiri', 'Hemi', 'Nikau'], f: ['Aroha', 'Mere', 'Hine', 'Kiri', 'Ngaio'], s: ['Ngata', 'Parata', 'Walker', 'Tamihana', 'Te Rangi'] },
	aussie: { m: ['Jack', 'Liam', 'Noah', 'Brodie', 'Mitch'], f: ['Charlotte', 'Olivia', 'Chloe', 'Matilda', 'Jess'], s: ['Smith', 'Jones', 'Brown', 'Nguyen', 'Kelly', 'Wilson'] },
	american: { m: ['Michael', 'James', 'Luis', 'Tyler', 'Darnell', 'Kevin', 'Cody'], f: ['Emily', 'Ashley', 'Maria', 'Jasmine', 'Hannah', 'Kayla', 'Grace'], s: ['Smith', 'Johnson', 'Garcia', 'Miller', 'Brown', 'Nguyen', 'Davis'] },
	mexican: { m: ['José', 'Juan', 'Luis', 'Jesús', 'Alejandro', 'Ricardo'], f: ['Guadalupe', 'María', 'Ximena', 'Fernanda', 'Lupita', 'Itzel'], s: ['Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez'] },
	// the research stations: people from everywhere, there for a season or a year
	station: { m: ['Tom', 'Javier', 'Hiroshi', 'Mateo', 'Erik', 'Sanjay', 'Kwame', 'Pierre', 'Dmitri', 'Wei'], f: ['Kate', 'Ana', 'Yuki', 'Ingrid', 'Priya', 'Chloé', 'Olivia', 'Mei', 'Sofía', 'Amara'], s: ['Clarke', 'Romero', 'Sato', 'Hansen', 'Iyer', 'Mensah', 'Dubois', 'Volkov', 'Chen', 'Walker'] },
	caribbean: { m: ['Andre', 'Marlon', 'Devon', 'Jean', 'Rafael', 'Kemar'], f: ['Shanice', 'Keisha', 'Marie', 'Yolanda', 'Tamika', 'Nadine'], s: ['Campbell', 'Williams', 'Joseph', 'Pierre', 'Rodríguez', 'Brown'] },
};

// ancestry targets [African, Asian, European] by culture (a base, each person varies round it)
const ANC = {
	inuit: [0.01, 0.82, 0.17], kalaallit: [0.01, 0.7, 0.29], inupiat: [0.01, 0.75, 0.24], sami: [0, 0.12, 0.88], nordic: [0, 0.02, 0.98],
	russian: [0, 0.05, 0.95], sakha: [0, 0.72, 0.28], nenets: [0, 0.68, 0.32], arab: [0.1, 0.04, 0.86], maghreb: [0.14, 0.02, 0.84],
	tuareg: [0.35, 0.02, 0.63], persian: [0.03, 0.06, 0.91], turkish: [0.02, 0.08, 0.9], caucasus: [0, 0.03, 0.97], central: [0.01, 0.48, 0.51],
	mongol: [0, 0.85, 0.15], tibetan: [0, 0.85, 0.15], nepali: [0.02, 0.55, 0.43], southasia: [0.12, 0.2, 0.68], chinese: [0, 0.96, 0.04],
	japanese: [0, 0.96, 0.04], korean: [0, 0.97, 0.03], vietnamese: [0.02, 0.92, 0.06], thai: [0.03, 0.9, 0.07], malay: [0.06, 0.86, 0.08],
	dayak: [0.05, 0.88, 0.07], filipino: [0.05, 0.85, 0.1], burmese: [0.04, 0.86, 0.1], swahili: [0.88, 0.02, 0.1], maasai: [0.9, 0.01, 0.09],
	westafrica: [0.95, 0.01, 0.04], mande: [0.94, 0.01, 0.05], akan: [0.96, 0.01, 0.03], nigeria: [0.96, 0.01, 0.03], hausa: [0.92, 0.01, 0.07], wolof: [0.95, 0.01, 0.04], horn: [0.68, 0.02, 0.3], southernafrica: [0.9, 0.02, 0.08], congo: [0.96, 0.01, 0.03], malagasy: [0.5, 0.42, 0.08],
	spanish: [0.02, 0.02, 0.96], andean: [0.03, 0.62, 0.35], brazil: [0.3, 0.08, 0.62], amazon: [0.04, 0.72, 0.24], portuguese: [0.03, 0.02, 0.95],
	french: [0.05, 0.03, 0.92], german: [0.02, 0.03, 0.95], italian: [0.02, 0.02, 0.96], greek: [0.02, 0.02, 0.96], balkan: [0.01, 0.02, 0.97],
	slavic: [0.01, 0.03, 0.96], british: [0.05, 0.05, 0.9], polynesian: [0.2, 0.55, 0.25], melanesian: [0.78, 0.15, 0.07], maori: [0.15, 0.55, 0.3],
	aussie: [0.03, 0.15, 0.82], station: [0.08, 0.22, 0.7], american: [0.14, 0.12, 0.74], mexican: [0.05, 0.42, 0.53], caribbean: [0.78, 0.04, 0.18],
};

// what is worn on the head, by custom (shares of grown-ups): scarf (women's headscarf),
// cap (a man's skullcap or knit cap), wrap (a man's head-wrap or headcloth), hat (a wide sun
// hat); and colours for them. Shares are rough and vary town to town; most rules leave it
// to the person.
const HEAD = {
	arab: { scarf: 0.55, wrap: 0.25, cap: 0.1 }, gulf: { scarf: 0.85, wrap: 0.6 }, maghreb: { scarf: 0.45, cap: 0.12, wrap: 0.06 },
	tuareg: { wrap: 0.85, scarf: 0.7 }, persian: { scarf: 0.65 }, turkish: { scarf: 0.35, cap: 0.05 }, central: { scarf: 0.35, cap: 0.3 },
	afpak: { scarf: 0.75, cap: 0.45, wrap: 0.15 }, southasia: { scarf: 0.3, wrap: 0.1, hat: 0.03 }, punjab: { wrap: 0.45, scarf: 0.35 },
	sahel: { scarf: 0.6, cap: 0.3, wrap: 0.2 }, horn: { scarf: 0.6, wrap: 0.05 }, swahili: { scarf: 0.3, cap: 0.15 },
	malay: { scarf: 0.55, cap: 0.15, hat: 0.1 }, viet: { hat: 0.25 }, andean: { hat: 0.55 }, mongol: { cap: 0.15 },
	westafrica: { scarf: 0.4, cap: 0.15 }, tibetan: { cap: 0.1 },
};

// culture rules: [id prefix, culture, head custom]; the longest matching prefix wins
const RULES = [
	['na.ak.north', 'inupiat'], ['na.ak', 'american'], ['na.can.arctic', 'inuit'], ['atl.greenland', 'kalaallit'],
	['eu.nordic.lapland', 'sami'], ['eu.nordic.svalbard', 'nordic'], ['eu.nordic', 'nordic'], ['atl.iceland', 'nordic'],
	['as.ru.yakutia', 'sakha'], ['as.ru.arctic', 'nenets'], ['as.ru', 'russian'], ['eu.east.ru', 'russian'], ['eu.east.ua', 'slavic'], ['eu.east', 'slavic'],
	['an', 'station'],
	['af.maghreb', 'maghreb', 'maghreb'], ['af.sahara', 'tuareg', 'tuareg'], ['af.sahel', 'mande', 'sahel'], ['af.west.hausa', 'hausa', 'sahel'], ['af.west.ng', 'nigeria', 'westafrica'], ['af.west.gh', 'akan', 'westafrica'], ['af.west.ci', 'akan', 'westafrica'], ['af.west.sn', 'wolof', 'sahel'], ['af.west', 'westafrica', 'westafrica'],
	['af.egypt', 'arab', 'arab'], ['af.sudan', 'arab', 'sahel'], ['af.horn', 'horn', 'horn'], ['af.east.rift', 'maasai', 'swahili'], ['af.east.coast', 'swahili', 'swahili'], ['af.east', 'swahili', 'swahili'],
	['af.congo', 'congo'], ['af.madagascar', 'malagasy'], ['af.south', 'southernafrica'], ['af', 'westafrica'],
	['as.tr', 'turkish', 'turkish'], ['as.caucasus', 'caucasus'], ['as.levant', 'arab', 'arab'], ['as.iraq', 'arab', 'arab'], ['as.arabia.gulf', 'arab', 'gulf'], ['as.arabia.dubai', 'arab', 'gulf'], ['as.arabia', 'arab', 'gulf'],
	['as.iran', 'persian', 'persian'], ['as.central.steppe', 'central', 'central'], ['as.central', 'central', 'central'], ['as.afpak.af', 'persian', 'afpak'], ['as.afpak', 'southasia', 'afpak'],
	['as.india.punjab', 'southasia', 'punjab'], ['as.india', 'southasia', 'southasia'], ['as.lanka', 'southasia', 'southasia'],
	['as.himalaya.khumbu', 'nepali', 'tibetan'], ['as.himalaya.kathmandu', 'nepali'], ['as.himalaya', 'tibetan', 'tibetan'], ['as.tibet', 'tibetan', 'tibetan'],
	['as.cn.xinjiang', 'central', 'central'], ['as.cn', 'chinese'], ['as.tw', 'chinese'], ['as.mongolia', 'mongol', 'mongol'], ['as.kr', 'korean'], ['as.jp', 'japanese'],
	['as.sea.vn', 'vietnamese', 'viet'], ['as.sea.th', 'thai'], ['as.sea.kh', 'thai'], ['as.sea.la', 'thai'], ['as.sea.mm', 'burmese'], ['as.sea.borneo', 'dayak'],
	['as.sea.my', 'malay', 'malay'], ['as.sea.id', 'malay', 'malay'], ['as.sea.sg', 'chinese'], ['as.sea.ph', 'filipino'], ['as.sea', 'malay', 'malay'], ['as', 'chinese'],
	['eu.uk', 'british'], ['eu.ie', 'british'], ['eu.es', 'spanish'], ['eu.pt', 'portuguese'], ['eu.fr', 'french'], ['eu.low', 'german'], ['eu.alps.ch', 'german'], ['eu.alps.dolomites', 'italian'],
	['eu.alps.chamonix', 'french'], ['eu.alps', 'german'], ['eu.it', 'italian'], ['eu.de', 'german'], ['eu.central', 'slavic'], ['eu.balkans', 'balkan'], ['eu.gr', 'greek'], ['eu.cyprus', 'greek'], ['eu.malta', 'italian'], ['eu', 'british'],
	['na.mx', 'mexican'], ['na.cam', 'mexican'], ['na.hi', 'polynesian'], ['na.pnw', 'american'], ['na.can', 'american'], ['na', 'american'],
	['atl.carib', 'caribbean'], ['atl.capeverde', 'caribbean'], ['atl', 'portuguese'],
	['sa.amazon', 'amazon'], ['sa.andes', 'andean', 'andean'], ['sa.br', 'brazil'], ['sa', 'spanish'],
	['oc.nz', 'maori'], ['oc', 'aussie'], ['pac.png', 'melanesian'], ['pac', 'polynesian'],
];
// where the old faiths' buildings stand in a town: what the skyline has, and its bells or call
const FAITH = [
	[/^as\.(sea\.id\.bali)/, 'mandir'],
	[/^(af\.(maghreb|sahara|sahel|egypt|sudan|west\.hausa|horn\.so|east\.coast)|as\.(tr|levant|iraq|arabia|iran|central|afpak|caucasus\.az|cn\.xinjiang|india\.bengal\.dhaka|sea\.(my|id)))/, 'mosque'],
	[/^as\.lanka/, 'wat'],
	[/^as\.(india|lanka)/, 'mandir'],
	[/^as\.(himalaya|tibet|mongolia)/, 'gompa'],
	[/^as\.sea\.(th|kh|la|mm)/, 'wat'],
	[/^as\.jp/, 'shrine'],
	[/^as\.(cn|tw|kr|sea\.vn|sea\.sg)/, 'temple'],
	[/^(eu\.(east|gr|cyprus|balkans\.(rs|bg))|as\.(ru|caucasus))/, 'orthodox'],
	[/^af\.horn\.et/, 'orthodox'],
	[/./, 'church'],
];

// greetings a people has of its own where the atlas region is wider than them
const SAY = {
	maasai: { greet: ['Supa!', 'Jambo!'], words: ['supa: hello (Maa)', 'ashe oleng: thank you very much (Maa)', 'enkang: a homestead'] },
	sami: { greet: ['Buorre beaivi!', 'Hei!'], words: ['buorre beaivi: good day (Northern Sámi)', 'giitu: thanks', 'joik: a Sámi song for a person or a place'] },
};
// the language people speak among themselves, where it is not the region's own (the atlas
// gives the region's: Intl names it)
const LANG = {
	inuit: 'Inuktitut', kalaallit: 'Kalaallisut (Greenlandic)', inupiat: 'Iñupiaq and English', sami: 'Northern Sámi and Swedish or Norwegian', sakha: 'Sakha and Russian', nenets: 'Nenets and Russian',
	tuareg: 'Tamasheq', mande: 'Bambara and French', hausa: 'Hausa', wolof: 'Wolof and French', akan: 'Twi and English', maasai: 'Maa and Swahili', swahili: 'Swahili',
	dayak: 'Iban and Malay', amazon: 'their own language and Portuguese', andean: 'Quechua and Spanish', tibetan: 'Tibetan', nepali: 'Nepali and Sherpa', mongol: 'Mongolian',
	maori: 'English and te reo Māori', polynesian: 'Samoan or Tongan and English', melanesian: 'Tok Pisin', station: 'English, and the languages of a dozen countries',
};
let names = null;
export function languageOf(C, code = '') {
	if (C && LANG[C.key]) return LANG[C.key];
	if (!code) return '';
	try { names = names || new Intl.DisplayNames(['en'], { type: 'language' }); return (names.of(code) || '').replace(/ Bokmål$/, ''); } catch { return ''; }
}
const seen = new Map();
// the culture of a region id: { key, names, ancestry, head }
export function cultureOf(id = '') {
	if (seen.has(id)) return seen.get(id);
	let best = null;
	for (const R of RULES) if ((id === R[0] || id.startsWith(R[0] + '.')) && (!best || R[0].length > best[0].length)) best = R;
	const key = best?.[1] || 'american';
	const out = { key, names: NAMES[key] || NAMES.american, ancestry: ANC[key] || ANC.american, head: HEAD[best?.[2]] || null, faith: FAITH.find(([re]) => re.test(id))[1], say: SAY[key] || null };
	seen.set(id, out);
	return out;
}

// a person's ancestry here, from their own draw: the culture's base, varied a little, and now
// and then someone from elsewhere (cities are mixed; villages less so)
export function ancestryFor(C, r, mixed = 0.08) {
	if (r() < mixed) { const pool = Object.values(ANC); return pool[Math.floor(r() * pool.length)].slice(); }
	const a = C.ancestry.map((v) => Math.max(0.005, v * (0.8 + r() * 0.4)));
	const s = a.reduce((x, y) => x + y, 0);
	return a.map((v) => v / s);
}

// a name: given and family
export function nameFor(C, male, r) {
	let N = C.names;
	if (N.g) { let u = r() * N.g.reduce((a, x) => a + x.w, 0); N = N.g.find((x) => (u -= x.w) <= 0) || N.g[0]; }
	const L = male ? N.m : N.f, S = (!male && N.sf) || N.s, first = L[Math.floor(r() * L.length)], last = S[Math.floor(r() * S.length)];
	// (family name first where that is the custom)
	return /^(chinese|korean|vietnamese|japanese|mongol)$/.test(C.key) ? { first, name: `${first} ${last}`, formal: `${last} ${first}` } : { first, name: `${first} ${last}` };
}
