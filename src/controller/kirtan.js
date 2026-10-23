import {promises as fs} from "fs";
import path from "path";

export default async function (req, res) {
    const kirtanGuide = {
        title: 'Kirtan Guide',
        code: 'en-KirtanGuide',
        chapters: []
    }

    await readFilesFromDirectory('./src/assets/kirtan-guide-en-london-main/json/songs', kirtanGuide);

    res.send(kirtanGuide);
}

async function readFilesFromDirectory(directoryPath, kirtanGuide) {
    try {
        const files = await fs.readdir(directoryPath);
        const audioMap = getAudioMap();

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile()) {
                const content = await fs.readFile(filePath, 'utf8');
                const chapter = {};
                const kirtan = JSON.parse(content);

                chapter.title = kirtan.title[0];
                chapter.code = file.replace('.json', '');

                if (audioMap[chapter.code]) {
                    chapter.audios = audioMap[chapter.code];
                }

                chapter.paragraphs = [{
                    text: chapter.title,
                    class: 'b47',
                }];

                if (kirtan.meta.author) {
                    chapter.author = kirtan.meta.author;
                    chapter.paragraphs.push({
                        text: 'by ' + chapter.author,
                        class: 'b79',
                    });
                }

                kirtan.verses.forEach((verse, verseIndex) => {
                    if (verse.text) {
                        let text = verse.text.join('<br />');

                        text = text.replace(/\\/g, '');

                        chapter.paragraphs.push({
                            text: text,
                            class: 'b60'
                        });
                    }

                    if (verse.translation) {
                        let translation = verse.translation.join('<br />');

                        if (/\*(.*?)\*/.test(translation)) {
                            translation = translation.replace(/\*(.*?)\*/g, '<span class="e3">$1</span>');
                        }

                        translation = translation.replace(/\\/g, '');

                        translation = '(' + (verseIndex + 1) + ') ' + translation;

                        chapter.paragraphs.push({
                            text: translation,
                            class: 'b50',
                            translationFlag: true
                        });
                    }
                });

                kirtanGuide.chapters.push(chapter);
            }
        }

    } catch (error) {
        console.error('Error reading directory:', error);
        throw error;
    }
}

function getAudioMap() {
    return {
        "anadi-karama-phole": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-5-anadi-karama-phole"
            }
        ],
        "aparadha-phole-mama": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-6-aparadha-phole-mama"
            }
        ],
        "bhaja-bhakata-vatsala-shri-gaurahari": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/swami-bs-govinda-maharaj-1"
            }
        ],
        "bhajahu-re-mana-shri-nanda-nandana": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/swami-bs-govinda-maharaj-3"
            },
            {
                "title": "Śrī Chaitanya Sāraswat Maṭh - 1980",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/bhajahu-re-mana"
            }
        ],
        "bhayabhanjana-jayashiamsana": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/dayita-dasa-pranati-srila-govinda-maharaj"
            }
        ],
        "bhuliya-tomare-samsare-asiya": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/bhuliya-tomare-srila-govinda-maharaj"
            }
        ],
        "bondhu-gon-shiunoho-vachana-mora": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-8-bondhu-gon"
            }
        ],
        "e-ghora-samsare-podiya-manava": [
            {
                "title": "Rai Kishori Didi",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/kijaya/farm-kirtans-2022-ei-ghora-samsare-2022-10-23"
            }
        ],
        "gaite-gaite-nama-ki-doshia-hoilo": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-7-gaite-gaite-nama"
            }
        ],
        "gaite-govinda-nam-upajilo-bhava-gram": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-7-gaite-gaite-nama"
            }
        ],
        "gurudeva-kripa-bindu-diya-kara-ei-dase": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/abiramthakur/3-gurudev-kripa-bindu-diya"
            }
        ],
        "hari-hari-biphole-janama-goyainu": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/hari-hari-biphale-janama-goyainu"
            }
        ],
        "he-deva-bhavantam-vande": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/kijaya/he-deva-bhavantam-vande"
            }
        ],
        "jashomati-nandana-vraja-vara-nagara": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/swami-bs-govinda-maharaj-2"
            }
        ],
        "jaya-guru-maharaja-jati-rajeshvara": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/srila-govinda-maharaj-kirtan"
            },
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj - Kaikhali 1989",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/sri-guru-arati-stuti-srila-govinda-maharaj-kaikhali-29091989"
            }
        ],
        "jaya-radhe-jaya-krishna-jaya-vrindavan": [
            {
                "title": "Sudarshan Prabhu",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/ante-glavina/sudarshan-prabhu-kirttan-of"
            }
        ],
        "manasa-deho-geho-jo-kichu-mora": [
            {
                "title": "Śrī Chaitanya Sāraswat Maṭh - 1980",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/manasa-deho-geho"
            }
        ],
        "nitai-pada-kamala-koti-chandra-sushitala": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/nitai-pada-kamala-srila-govinda-maharaj-1990"
            }
        ],
        "parama-karuna-pahu-dui-jana": [
            {
                "title": "Śrī Chaitanya Sāraswat Maṭh - 1980",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/parama-karuna"
            }
        ],
        "pita-varana-kali-pavana-gora": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-1-pita-barana-kali-pavana"
            }
        ],
        "prabhu-tava-pada-juge-mora-nivedana": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-4-prabhu-tava-pada-juge"
            }
        ],
        "radha-madhava-kunja-bihari": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/swami-bs-govinda-maharaj-4"
            }
        ],
        "sakhi-go-kemote-dhoribo-paran": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-7-gaite-gaite-nama"
            }
        ],
        "samsara-davanala-lidha-loka": [
            {
                "title": "Śrī Chaitanya Sāraswat Maṭh - 1980",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/samsara-davanala-lidha-loka"
            }
        ],
        "sarvasva-tomara-charane-sanpiya": [
            {
                "title": "Sudarshan Prabhu",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/kijaya/farm-kirtans-2022-sarvasva"
            }
        ],
        "shri-guru-charana-padma-kevala-bhakati": [
            {
                "title": "Śrī Chaitanya Sāraswat Maṭh - 1980",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/sri-guru-charana-padma-sri"
            }
        ],
        "shri-krishna-chaitanya-prabhu-daya-kara-more": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/swami-bs-govinda-maharaj"
            }
        ],
        "shri-krishna-chaitanya-prabhu-nityananda": [
            {
                "title": "Śrī Chaitanya Sāraswat Maṭh - 1980",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/pancha-tattva-kirtan"
            }
        ],
        "shri-krishna-kirtane-jodi-manasa-tohara": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-3-sri-krishna-kirttane"
            }
        ],
        "shri-rupa-manjari-pada-sei-mora-sampada": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/sri-rupa-srila-govinda-maharaj"
            }
        ],
        "sujanarvuda-radhita-pada-yugam": [
            {
                "title": "Śrī Chaitanya Sāraswat Maṭh - 1980",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/sujanarvuda-radhita-clip"
            }
        ],
        "tuhu-daya-sagara-tarayite-prani": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-2-tuhu-doya-sagara-mp3"
            }
        ],
        "tumi-sarveshvareshvara-vrajendra-kumara": [
            {
                "title": "Rai Kishori Didi",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/kijaya/farm-kirtans-2022-tumi"
            }
        ],
        "vaishnava-thakura-dayara-sagara": [
            {
                "title": "Śrī Chaitanya Sāraswat Maṭh - 1980",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/ohe-vaisnava-thakura-parama"
            }
        ],
        "yo-nanto-nanta-vaktrair-niravadhi": [
            {
                "title": "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāj",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/srilagovindamaharaj"
            }
        ],
        "yoga-pithopari-sthita-ashta-sakhi-subeshtita": [
            {
                "title": "Śrī Śikṣāṣṭakam Kīrtan",
                "link": "https://w.soundcloud.com/player/?url=https://soundcloud.com/jayasri-sound/song-8-bondhu-gon"
            }
        ]
    };
}