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
  prefix: string;
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
  feed: [
    {
      type: "text",
      id: "entry-restart",
      lines: [
        [
          "重新开始总是既令人畏惧又让人兴奋。今天，我专注于做",
          {
            type: "annotation",
            target: "减法",
            note: "圈出来是为了强调这不是口号，而是最近真的在做的取舍练习。",
            mode: "inline",
          },
          "而非加法。生活不需要那么多复杂的层级。",
        ],
      ],
      meta: {
        prefix: "记",
        source: "发表于 微博",
        date: "2024年3月12日",
      },
    },
    {
      type: "image",
      id: "entry-ink-and-code",
      image: {
        src: "/images/polaroid-desk.svg",
        alt: "桌面上的纸张和笔记本占位插画",
        caption: "拍立得式照片占位图",
      },
      lines: [
        [
          "墨水与代码的初次碰撞。在这个数字化泛滥的时代，",
          {
            type: "annotation",
            target: "物理的笔触感",
            note: "这里想做成像老师批注一样的页边提醒，把“触感”这个关键词从正文里拎出来。",
            mode: "inline",
            side: "left",
          },
          "依然能够带给我最纯粹的宁静。",
        ],
      ],
      meta: {
        prefix: "光",
        source: "发表于 Instagram",
        date: "2024年2月28日",
      },
    },
    {
      type: "article",
      id: "entry-paper-margin",
      title: "《白纸的留白之美》",
      summary:
        "这篇文章探讨了为什么在高度数字化的今天，我们依然迷恋纸张的纹理与不确定性……",
      ctaLabel: "阅读全文",
      ctaHref: "#",
      meta: {
        prefix: "∞",
        source: "发表于 个人博客",
        date: "2024年2月15日",
      },
    },
    {
      type: "quote",
      id: "entry-red-ink",
      quote: [
        [
          { text: "它喜欢", mark: "plain" },
          { text: "引起注意力", mark: "highlight" },
          {
            text: "。它是修正的颜色，但也是激情与瞬间灵感的颜色。",
            mark: "plain",
          },
        ],
      ],
      meta: {
        prefix: "❞",
        source: "发表于 随笔",
        date: "2024年2月15日",
      },
    },
    {
      type: "project",
      id: "entry-paper-webgl",
      image: {
        src: "/images/project-paper-lab.svg",
        alt: "打开的速写本和纸笔的项目示意图",
      },
      title: "纸墙纹理实验",
      summary: [
        [
          "实验性的",
          " <highlight>WebGL</highlight> ",
          {
            type: "annotation",
            target: "“物理”的温度",
            note: "这个批注气泡更像手帐边栏里的旁白，用来解释为什么这个项目对我重要。",
            mode: "inline",
            side: "right",
          },
          "纹理，模拟撕裂再生纸的质感。这让我更着迷于数字界面里那一点点",
          "“物理”的温度。",
        ],
      ],
      meta: {
        prefix: "Σ",
        source: "发表于 Github",
        date: "2024年1月20日",
      },
    },
    {
      type: "text",
      id: "entry-old-pen",
      lines: [
        ["新年，旧笔"],
        [
          "可靠性被低估了。在尝试新形状的同时，坚持那些行之有效的工具。就像这支陪伴我三年的老钢笔。",
        ],
      ],
      meta: {
        prefix: "♬",
        source: "发表于 朋友圈",
        date: "2024年1月01日",
      },
    },
  ],
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
