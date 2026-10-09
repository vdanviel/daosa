import path from "node:path";
import url from 'url';

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
    cEnv = process.env.CURRENT_ENVIRONMENT;

    if (cEnv == "prod") {
      return "prod"
    }else{
      return "dev"
    }

  }

}

export default Utils;