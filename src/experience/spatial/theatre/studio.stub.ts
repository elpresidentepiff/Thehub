// Production stand-in for @theatre/studio (see next.config.ts). The studio is an editor and is
// never shipped; anything that reaches for it outside `next dev` gets this inert object.
const studio = {
  initialize() {},
  ui: { hide() {}, restore() {} },
};
export default studio;
