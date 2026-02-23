
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, Gender, AccountStatus, SubscriptionPlan } from "../types";

export const MASTER_DATA = {
  occupations: ['経営者・役員', '医師', '弁護士', '会計士・税理士', '投資家', 'パイロット', 'コンサルタント', '外資金融', '大手商社', '広告代理店', '建築家', 'ファッション関係', 'モデル', '芸能関係', '公務員', '大手企業', 'クリエイティブ', 'その他'],
  educations: ['東京大学', '京都大学', '一橋大学', '慶應義塾大学', '早稲田大学', '上智大学', 'MARCH', '関関同立', '海外大学', '大学院卒', '医学部', 'その他'],
  incomes: ['500万円〜', '1000万円〜', '2000万円〜', '3000万円〜', '5000万円〜', '1億円〜', '非公開'],
  bodyTypes: ['スリム', 'モデル体型', '細マッチョ', '筋肉質', '標準', 'グラマラス', 'ぽっちゃり'],
  locations: ['港区', '渋谷区', '中央区', '千代田区', '目黒区', '世田谷区', '新宿区', '恵比寿', '代官山', '横浜', 'その他']
};

const getPlaceholders = (gender: Gender, count: number, seed: string) => {
  const images = [];
  for (let i = 0; i < count; i++) {
    const genderSeed = gender === Gender.Male ? `male-${seed}` : `female-${seed}`;
    images.push(`https://picsum.photos/seed/${genderSeed}${i}/400/600`);
  }
  return images;
};

const FALLBACK_NAMES_MALE = ['ケンタロウ', 'ショウタ', 'ユウスケ', 'リョウ', 'ダイスケ', 'カズキ'];
const FALLBACK_NAMES_FEMALE = ['エリナ', 'ミサキ', 'ナナコ', 'ユリカ', 'アヤ', 'ハルカ'];

const createFallbackProfile = (gender: Gender, index: number): UserProfile => {
  const names = gender === Gender.Male ? FALLBACK_NAMES_MALE : FALLBACK_NAMES_FEMALE;
  const name = names[index % names.length];
  const occupation = MASTER_DATA.occupations[index % MASTER_DATA.occupations.length];
  const income = MASTER_DATA.incomes[index % MASTER_DATA.incomes.length];
  const education = MASTER_DATA.educations[index % MASTER_DATA.educations.length];
  const location = MASTER_DATA.locations[index % MASTER_DATA.locations.length];
  const bodyType = MASTER_DATA.bodyTypes[index % MASTER_DATA.bodyTypes.length];

  return {
    id: `fallback-${gender}-${Date.now()}-${index}`,
    name,
    age: 24 + (index % 15),
    gender,
    occupation,
    income,
    education,
    location,
    height: gender === Gender.Male ? 170 + (index % 15) : 155 + (index % 15),
    bodyType,
    bio: "洗練された時間と価値観を共有できる方と出会いたいと思っています。どうぞよろしくお願いします。",
    imageUrls: getPlaceholders(gender, 3, `${name}-${index}`),
    tags: ['グルメ', '旅行', 'アート'],
    isVerified: true,
    status: AccountStatus.Approved,
    subscription: SubscriptionPlan.Free
  };
};

export const generateEliteProfiles = async (count: number = 5, targetGender: Gender): Promise<UserProfile[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const genderInJapanese = targetGender === Gender.Male ? "男性" : "女性";
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `東カレデートのような日本の高級マッチングアプリ向けの、架空のハイステータスなプロフィールを${count}件生成してください。
      必ず「${genderInJapanese}」のプロフィールのみを生成してください。
      
      【制約事項】
      以下のリストから厳格に選択してください：
      職業：${MASTER_DATA.occupations.join(', ')}
      学歴：${MASTER_DATA.educations.join(', ')}
      年収：${MASTER_DATA.incomes.join(', ')}
      体型：${MASTER_DATA.bodyTypes.join(', ')}
      居住地：${MASTER_DATA.locations.join(', ')}
      
      自己紹介文（bio）は、日本の高級アプリらしい、洗練された丁寧な日本語で100文字以内で作成してください。
      必ず以下のJSON形式で返してください。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              age: { type: Type.INTEGER },
              gender: { type: Type.STRING, enum: [targetGender] },
              occupation: { type: Type.STRING },
              income: { type: Type.STRING },
              education: { type: Type.STRING },
              location: { type: Type.STRING },
              height: { type: Type.INTEGER },
              bodyType: { type: Type.STRING },
              bio: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["name", "age", "gender", "occupation", "income", "location", "bio", "bodyType", "education", "height"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    const rawData = JSON.parse(text);

    return rawData.map((data: any, index: number) => ({
      ...data,
      id: `gen-${Date.now()}-${index}`,
      imageUrls: getPlaceholders(targetGender, 3, data.name.replace(/\s/g, '')),
      isVerified: Math.random() > 0.3,
      status: AccountStatus.Approved,
      subscription: SubscriptionPlan.Free,
    }));
  } catch (error) {
    console.warn("Gemini API error. Falling back to mock data.", error);
    return Array.from({ length: count }).map((_, i) => createFallbackProfile(targetGender, i));
  }
};

export const chatWithPersona = async (
  history: { role: string; content: string }[],
  profile: UserProfile
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: "user",
          parts: [{ text: `あなたはマッチングアプリで以下の人物として振る舞ってください：
            名前: ${profile.name}
            職業: ${profile.occupation}
            自己紹介: ${profile.bio}
            トーン：知的で洗練されており、少し余裕のある丁寧な日本語。短く1〜2文で返信してください。`}]
        },
        ...history.map(h => ({
          role: h.role === 'me' ? 'user' : 'model',
          parts: [{ text: h.content }]
        }))
      ],
    });
    return response.text || "メッセージありがとうございます。";
  } catch (error) {
    return "今は少し忙しいので、また後で連絡しますね。";
  }
};
