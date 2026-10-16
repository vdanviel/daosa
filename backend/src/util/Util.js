import path from "node:path";
import url from 'url';
import Env from './Env.js';

class Utils {

  static getTemplatePath(callerDir) {
    return path.dirname(url.fileURLToPath(callerDir));
  }

  static generateCode(len = 6) {
    const characters = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

    let code = "";
    for (let index = 0; index < len; index++) {
        code += characters[Math.floor(Math.random() * 10)];
    }

    return code;

  }

  static isValidDocument(document) {
    const digits = String(document ?? '').replace(/\D/g, '');

    if (digits.length === 11) {
        if (/^(\d)\1{10}$/.test(digits)) return false;
        const numbers = digits.split('').map(Number);
        const first = (numbers.slice(0, 9).reduce((sum, digit, index) => sum + digit * (10 - index), 0) * 10) % 11 % 10;
        const second = (numbers.slice(0, 10).reduce((sum, digit, index) => sum + digit * (11 - index), 0) * 10) % 11 % 10;
        return first === numbers[9] && second === numbers[10];
    }

    if (digits.length === 14) {
        if (/^(\d)\1{13}$/.test(digits)) return false;
        const calculateDigit = (base, weights) => {
            const remainder = base.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
            return remainder < 2 ? 0 : 11 - remainder;
        };
        const numbers = digits.split('').map(Number);
        const first = calculateDigit(numbers.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
        const second = calculateDigit(numbers.slice(0, 12).concat(first), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
        return first === numbers[12] && second === numbers[13];
    }

    return false;
};

  static formatDate(date) {
    try {
      const formattedDate = new Date(date + "T00:00:00Z"); // força UTC
      return formattedDate.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    } catch (error) {
      throw new Error("Invalid date format provided to formatDate");
    }
  }

  //libera a data em yyyy-mm-dd hh:ss
  static currentDateTime(timezone){
    const date = new Date();
    // Format: yyyy-MM-dd HH:mm, timezone: Sao Paulo
    const options = { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    const formattedDate = new Intl.DateTimeFormat('pt-BR', options).format(date).replace(',', '');
    
    // Convert to "2024-06-27 15:30"
    const [day, month, year, hour, minute] = formattedDate.match(/\d+/g);
    const timezoneDate = `${year}-${month}-${day} ${hour}:${minute}`;

    return timezoneDate;
  }

  static getCurrentEnroviment(){
    if (Env.getCurrentEnvironment() === "prod") {
      return "prod"
    }else{
      return "dev"
    }

  }

  static getSessionSecret(){

    return Env.getSessionSecretPass();

  }

  static getSpaUrl(){

    return Env.getSpaApplicationUrl();

  }

  static getPort(){

    return Env.getPort();

  }

}

export default Utils;