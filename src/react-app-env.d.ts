/// <reference types="react-scripts" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
