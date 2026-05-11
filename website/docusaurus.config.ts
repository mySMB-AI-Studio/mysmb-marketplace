import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'mySMB Marketplace',
  tagline: 'Curated agent plugins for SMB-focused business integrations',
  favicon: 'img/favicon.svg',

  url: 'https://mySMB-AI-Studio.github.io',
  baseUrl: '/mysmb-marketplace/',

  organizationName: 'mySMB-AI-Studio',
  projectName: 'mysmb-marketplace',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl:
            'https://github.com/mySMB-AI-Studio/mysmb-marketplace/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'mySMB Marketplace',
      logo: {
        alt: 'mySMB Marketplace logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        { to: '/catalog', label: 'Plugin catalog', position: 'left' },
        { to: '/widgets/overview', label: 'Widgets', position: 'left' },
        {
          href: 'https://github.com/mySMB-AI-Studio/mysmb-marketplace',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting started', to: '/intro' },
            { label: 'Plugin catalog', to: '/catalog' },
            { label: 'Authoring guide', to: '/authoring/overview' },
            { label: 'Widgets', to: '/widgets/overview' },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/mySMB-AI-Studio/mysmb-marketplace',
            },
            {
              label: 'MyHub',
              href: 'https://github.com/mySMB-AI-Studio/myHubV2',
            },
            {
              label: 'myhub-mcp-servers',
              href: 'https://github.com/mySMB-AI-Studio/myhub-mcp-servers',
            },
          ],
        },
        {
          title: 'External',
          items: [
            {
              label: 'Vercel json-render',
              href: 'https://json-render.vercel.app/',
            },
            {
              label: 'Model Context Protocol',
              href: 'https://modelcontextprotocol.io/',
            },
            {
              label: 'Claude Code plugins',
              href: 'https://docs.anthropic.com/claude-code/plugins',
            },
          ],
        },
      ],
      copyright: `MIT-licensed. Built by mySMB AI Studio. © ${new Date().getFullYear()}.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript', 'tsx'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
