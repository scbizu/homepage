export type InlineMark = "plain" | "circle" | "highlight";
export type AnnotationSide = "left" | "right";
export type AnnotationMode = "inline" | "margin";

export interface InlineToken {
  text: string;
  mark?: InlineMark;
  href?: string;
}

export interface AnnotatedSegment {
  type: "annotation";
  target: string | InlineToken[];
  note: string | InlineToken[];
  mode?: AnnotationMode;
  side?: AnnotationSide;
}

export type LineSegment = string | InlineToken[] | AnnotatedSegment;

export interface EntryMeta {
  prefix?: string;
  source: string;
  date: string;
}

export interface ProfileCard {
  name: string;
  role: InlineToken[];
  note: LineSegment[];
  intro: LineSegment[];
  avatar: {
    src: string;
    alt: string;
  };
}

export interface HeroContent {
  title: string;
  subtitle: string;
}

export interface TextFeedEntry {
  type: "text";
  id: string;
  lines: LineSegment[][];
  meta: EntryMeta;
}

export interface ImageFeedEntry {
  type: "image";
  id: string;
  image: {
    src: string;
    alt: string;
    caption: string;
  };
  lines: LineSegment[][];
  meta: EntryMeta;
}

export interface ArticleFeedEntry {
  type: "article";
  id: string;
  title: string;
  summary: string;
  ctaLabel: string;
  ctaHref: string;
  meta: EntryMeta;
}

export interface QuoteFeedEntry {
  type: "quote";
  id: string;
  quote: InlineToken[][];
  meta: EntryMeta;
}

export interface ProjectFeedEntry {
  type: "project";
  id: string;
  image: {
    src: string;
    alt: string;
  };
  title: string;
  summary: LineSegment[][];
  meta: EntryMeta;
}

export type FeedEntry =
  | TextFeedEntry
  | ImageFeedEntry
  | ArticleFeedEntry
  | QuoteFeedEntry
  | ProjectFeedEntry;

export interface FooterContent {
  year: string;
  note: string;
  links: Array<{
    label: string;
    href: string;
  }>;
}

export interface HomepageContent {
  siteTitle: string;
  profile: ProfileCard;
  hero: HeroContent;
  feed: FeedEntry[];
  footer: FooterContent;
}

export const homepage: HomepageContent = {
  siteTitle: "手帐",
  profile: {
    name: "Nace Sc",
    role: [
      {
        text: "十八线程序员 | 退役二次元 | 牌佬 | 单身大魔导师",
        mark: "plain",
      },
    ],
    note: [
      {
        type: "annotation",
        target: "Reject modernity, embrace <highlight>normality</highlight>",
        note: `这句话出自一位星际争霸2评论员对于 「中国星际争霸2选手李培南在 IEM 卡托维兹站 以 0.37% 的概率爆冷夺冠」时的评论，
        意为「拒绝卓越，拥抱平庸」，我以此来鼓励自己不要因为出身平庸而放弃追逐梦想的热情，也与大家共勉。`,
        mode: "inline",
      },
      "!",
    ],
    intro: [
      "🙌 欢迎光临 Nace 的情感树洞，这里保留了一些我",
      "<highlight>日常的生活记录</highlight>",
      "和对 ",
      "<highlight>这个世界的思考</highlight>。作为某朋友圈的替代，我希望能自己构建一个让我自己更舒服的表达空间。",
      "这里更多的是琐碎的日常，一些完整的文章可以移步[我的技术博客](https://blog.scnace.me) 🫶",
    ],
    avatar: {
      src: "/images/avatar-stamp.svg",
      alt: "带有圆角边框的个人头像占位图",
    },
  },
  hero: {
    title: "光阴副本",
    subtitle: "月晕下的孤魂，被过去戳的好疼，看来时路出神",
  },
  feed: [],
  footer: {
    year: "2026",
    note: "留一点时间和空间给自己呼吸",
    links: [
      { label: "Telegram", href: "https://t.me/scnace" },
      { label: "GitHub", href: "https://github.com/scbizu" },
      { label: "X", href: "https://x.com/scnace" },
      { label: "邮箱", href: "mailto:i@scnace.me" },
    ],
  },
};
