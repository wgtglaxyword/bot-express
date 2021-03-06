"use strict";

const debug = require("debug")("bot-express:skill");
const parser = require("../sample_service/parser");
const mecab = require("mecabaas-client");

module.exports = class SkillHandlePizzaOrder {

    // コンストラクター。このスキルで必要とする、または指定することができるパラメータを設定します。
    constructor() {
        this.required_parameter = {
            pizza: {
                message_to_confirm: {
                    type: "template",
                    altText: "ご注文のピザはお決まりでしょうか？ マルゲリータ、マリナーラからお選びください。",
                    template: {
                        type: "buttons",
                        text: "ご注文のピザはお決まりでしょうか？",
                        actions: [
                            {type:"message",label:"マルゲリータ",text:"マルゲリータ"},
                            {type:"message",label:"マリナーラ",text:"マリナーラ"}
                        ]
                    }
                },
                parser: "dialogflow",
                reaction: (error, value, bot, event, context, resolve, reject) => {
                    if (error){
                        if (value == "") return resolve();
                        bot.change_message_to_confirm("pizza", {
                            type: "text",
                            text: "恐れ入りますが当店ではマルゲリータかマリナーラしかございません。どちらになさいますか？"
                        });
                    } else {
                        bot.queue({
                            type: "text",
                            text: `${value}ですね。ありがとうございます。`
                        });
                    }
                    return resolve();
                }
            },
            size: {
                message_to_confirm: {
                    type: "template",
                    altText: "サイズはいかがいたしましょうか？ S、M、Lからお選びください。",
                    template: {
                        type: "buttons",
                        text: "サイズはいかがいたしましょうか？",
                        actions: [
                            {type:"message",label:"S",text:"S"},
                            {type:"message",label:"M",text:"M"},
                            {type:"message",label:"L",text:"L"}
                        ]
                    }
                },
                parser: "dialogflow"
            },
            address: {
                message_to_confirm: {
                    type: "text",
                    text: "お届け先の住所を教えていただけますか？"
                },
                parser: (value, bot, event, context, resolve, reject) => {
                    if (typeof value == "string"){
                        return resolve({
                            address: value,
                            latitude: null,
                            longitude: null
                        })
                    } else if (typeof value == "object"){
                        if (value.address){
                            // This is LINE location message.
                            return resolve({
                                address: value.address,
                                latitude: value.latitude,
                                longitude: value.longitude
                            })
                        } else if (value.attachments){
                            for (let attachment of value.attachments){
                                if (attachment.type == "location"){
                                    return resolve({
                                        address: null, // Need to fill out some day...
                                        latitude: attachment.payload.coordinates.lat,
                                        longitude: attachment.payload.coordinates.long
                                    })
                                }
                            }
                        }
                    }

                    return reject();
                }
            },
            name: {
                message_to_confirm: {
                    type: "text",
                    text: "お客様のお名前を教えていただけますか？"
                },
                parser: (value, bot, event, context, resolve, reject) => {
                    let lastname, firstname, fullname;
                    return mecab.parse(value).then(
                        (response) => {
                            for (let elem of response){
                                if (elem[3] == "人名" && elem[4] == "姓"){
                                    lastname = elem[0];
                                } else if (elem[3] == "人名" && elem[4] == "名"){
                                    firstname = elem[0];
                                }
                            }
                            fullname = "";
                            if (lastname) fullname += lastname + " "; // Add trailing space. It will be removed if we don't have firstname.
                            if (firstname) fullname += firstname;
                            if (fullname == "") return reject();
                            return resolve(fullname.trim());
                        },
                        (response) => {
                            return reject(response);
                        }
                    )
                }
            },
            review: {
                message_to_confirm: (bot, event, context, resolve, reject) => {
                    let message = {
                        type: "template",
                        altText: `最後にご注文内容の確認です。${context.confirmed.pizza}の${context.confirmed.size}サイズでよろしかったでしょうか？`,
                        template: {
                            type: "confirm",
                            text: `最後にご注文内容の確認です。${context.confirmed.pizza}の${context.confirmed.size}サイズでよろしかったでしょうか？`,
                            actions: [
                                {type: "message", label: "はい", text: "はい"},
                                {type: "message", label: "いいえ", text: "いいえ"}
                            ]
                        }
                    }
                    return resolve(message);
                },
                parser: {type: "dialogflow", parameter: "yes_no"},
                reaction: (error, value, bot, event, context, resolve, reject) => {
                    if (error) return resolve();

                    if (value === "いいえ"){
                        bot.collect("size");
                        bot.collect("pizza");
                    }
                    return resolve();
                }
            }
        }

        this.clear_context_on_finish = true;
    }

    // パラメーターが全部揃ったら実行する処理を記述します。
    finish(bot, event, context, resolve, reject){
        const messages = [{
            text: `${context.confirmed.name} 様、ご注文ありがとうございました！${context.confirmed.pizza}の${context.confirmed.size}サイズを30分以内にご指定の${context.confirmed.address.address}までお届けに上がります。`
        }];
        return bot.reply(messages).then(response => {
            return resolve(response);
        });
    }
};
