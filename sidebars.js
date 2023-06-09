/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  // tutorialSidebar: [{type: 'autogenerated', dirName: '.'}],

  threejsSidebar: [
    // {type: 'autogenerated', dirName: 'wiki/threejs',},
    {
      type: "category",
      label: "Three.js",
      link: { type: "doc", id: "wiki/threejs/index" },
      collapsible: false,
      items: [
        {type: 'autogenerated', dirName: 'wiki/threejs'}
      ],
    },
  ],

  commonSidebar: [
    {
      type: "category",
      label: "碎片记录",
      link: { type: "doc", id: "wiki/common/index" },
      collapsible: false,
      items: [
        {type: 'autogenerated', dirName: 'wiki/common'},
      ]
    },
  ],

  interviewSidebar: [
    {
      type: "category",
      label: "面试锦集",
      link: { type: "doc", id: "interview/index" },
      collapsible: false,
      items: [
        {type: 'autogenerated', dirName: 'interview'},
      ]
    }
  ],



};

module.exports = sidebars;
