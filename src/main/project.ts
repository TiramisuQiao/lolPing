import metadata from '../../package.json';

// The packaged updater and the app's links share one release destination.
const { owner, repo } = metadata.build.publish[0];
export const PROJECT_URL = `https://github.com/${owner}/${repo}`;
export const RELEASES_API = `https://api.github.com/repos/${owner}/${repo}`;
export const APP_ID = metadata.build.appId;
