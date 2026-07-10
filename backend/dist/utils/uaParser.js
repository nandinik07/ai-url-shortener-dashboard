"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUserAgent = parseUserAgent;
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
function parseUserAgent(userAgentString) {
    if (!userAgentString) {
        return { browser: "Unknown", os: "Unknown" };
    }
    try {
        const parser = new ua_parser_js_1.default(userAgentString);
        const browserName = parser.getBrowser().name || "Unknown";
        const osName = parser.getOS().name || "Unknown";
        return {
            browser: browserName,
            os: osName
        };
    }
    catch (error) {
        // Fallback simple regex evaluation if ua-parser-js fails or is not working properly
        const ua = userAgentString.toLowerCase();
        let browser = "Unknown";
        let os = "Unknown";
        if (ua.includes("chrome"))
            browser = "Chrome";
        else if (ua.includes("safari") && !ua.includes("chrome"))
            browser = "Safari";
        else if (ua.includes("firefox"))
            browser = "Firefox";
        else if (ua.includes("edge"))
            browser = "Edge";
        if (ua.includes("windows"))
            os = "Windows";
        else if (ua.includes("macintosh") || ua.includes("mac os"))
            os = "macOS";
        else if (ua.includes("iphone") || ua.includes("ipad"))
            os = "iOS";
        else if (ua.includes("android"))
            os = "Android";
        else if (ua.includes("linux"))
            os = "Linux";
        return { browser, os };
    }
}
