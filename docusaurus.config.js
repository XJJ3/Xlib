// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Xlib",
  tagline: "Dinosaurs are cool",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://xlib.top",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  organizationName: "XJJ3",
  projectName: "Xlib",
  deploymentBranch: "gh-pages",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "zh-Hans",
    locales: ["zh-Hans"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        pages: {
          path: "src/pages",
          // 指定 pages 的路由路径，因为 blog 作为主页了
          routeBasePath: "/pages",
        },
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          breadcrumbs: false,

          // 自定义侧边栏生成器，过滤index.md索引页
          async sidebarItemsGenerator({defaultSidebarItemsGenerator, ...args}) {
            const sidebarItems = await defaultSidebarItemsGenerator(args);
            const newSidebarItems = sidebarItems.filter((item) => {
              if(item.type !== 'doc') return true;
              return !(/\/index$/.test(item.id));
            });
            return newSidebarItems;
          },
        },
        blog: {
          routeBasePath: "/",
          path: "./blog",
          showReadingTime: true,
          readingTime: ({ content, defaultReadingTime }) => defaultReadingTime({ content, options: { wordsPerMinute: 100 } }),
          postsPerPage: 2,
          blogSidebarCount: 10
          
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: "img/docusaurus-social-card.jpg",
      navbar: {
        title: "Xlib",
        logo: {
          alt: "Xlib",
          src: "img/logo.svg",
          width: 28,
        },
        items: [
          { to: "/pages", label: "Home", position: "right", exact: true },
          {
            type: "dropdown",
            position: "right",
            label: "Wiki",
            items: [
              {
                // type: 'doc',
                // docId: "wiki/threejs/index",
                type: "docSidebar",
                sidebarId: "threejsSidebar",
                label: "Three.js",
              },
              {
                type: "docSidebar",
                sidebarId: "commonSidebar",
                label: "碎片记录",
              },
            ],
          },
          {
            type: "docSidebar",
            sidebarId: "interviewSidebar",
            position: "right",
            label: "Interview",
          },
          { to: "/", label: "Blog", position: "right", exact: true },
          {
            type: "docSidebar",
            sidebarId: "interviewSidebar",
            position: "right",
            label: "Learn",
          },
          {
            href: "https://github.com/facebook/docusaurus",
            label: "GitHub",
            position: "right",
          },
          { type: "search", position: "right" },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Tutorial",
                to: "/",
              },
            ],
          },
          {
            title: "Community",
            items: [
              {
                label: "Stack Overflow",
                href: "https://stackoverflow.com/questions/tagged/docusaurus",
              },
              {
                label: "Discord",
                href: "https://discordapp.com/invite/docusaurus",
              },
              {
                label: "Twitter",
                href: "https://twitter.com/docusaurus",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "Blog",
                to: "/",
              },
              {
                label: "GitHub",
                href: "https://github.com/facebook/docusaurus",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
