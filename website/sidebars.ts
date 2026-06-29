import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Get started',
      collapsed: false,
      items: ['intro', 'catalog'],
    },
    {
      type: 'category',
      label: 'Authoring a plugin',
      collapsed: false,
      items: [
        'authoring/overview',
        'authoring/mcp-server',
        'authoring/skills',
        'authoring/agents',
        'authoring/widget-elements',
        'authoring/client-portals',
        'authoring/validate-and-ship',
      ],
    },
    {
      type: 'category',
      label: 'Building widgets',
      collapsed: false,
      items: [
        'widgets/overview',
        {
          type: 'category',
          label: 'Tutorials',
          collapsed: false,
          items: [
            'widgets/tutorial-1-first-widget',
            'widgets/tutorial-2-live-data',
            'widgets/tutorial-3-computed-transforms',
            'widgets/tutorial-4-composite-widget',
          ],
        },
        'widgets/spec-primitives',
        'widgets/components-reference',
        'widgets/json-render',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: [
        'reference/plugin-json',
        'reference/mcp-json',
        'reference/widget-json',
        'reference/validator-rules',
      ],
    },
    'contributing',
  ],
};

export default sidebars;
