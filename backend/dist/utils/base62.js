"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Base62 = void 0;
class Base62 {
    static ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    static BASE = 62;
    /**
     * Encodes a positive integer into a Base62 string.
     */
    static encode(num) {
        if (num === 0)
            return this.ALPHABET[0];
        let encoded = "";
        let temp = num;
        while (temp > 0) {
            const remainder = temp % this.BASE;
            encoded = this.ALPHABET[remainder] + encoded;
            temp = Math.floor(temp / this.BASE);
        }
        return encoded;
    }
    /**
     * Decodes a Base62 string back into a positive integer.
     */
    static decode(str) {
        let num = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const index = this.ALPHABET.indexOf(char);
            if (index === -1) {
                throw new Error(`Invalid character '${char}' in Base62 string`);
            }
            num = num * this.BASE + index;
        }
        return num;
    }
    /**
     * Generates a random alphanumeric short code of a specific length.
     * Useful when we want to generate a non-predictable code.
     */
    static randomCode(length = 6) {
        let result = "";
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * this.BASE);
            result += this.ALPHABET[randomIndex];
        }
        return result;
    }
}
exports.Base62 = Base62;
