// The purpose of this file is to import gl-matrix and re-export it.
// This makes it easy to manage the dependency from a single point.

// Import from a CDN. In a real project, you would use a package manager like npm.
import * as glMatrix from "https://cdn.skypack.dev/gl-matrix";

export default glMatrix;
