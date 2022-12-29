import * as Emoji from 'node-emoji';
import { VERSION } from '@electrobot/domain';

export const EMOJ_UA = Emoji.get(Emoji.emoji['flag-ua']);
export const EMOJ_POOP = Emoji.get(Emoji.emoji['poop']);
export const EMOJ_BULB = Emoji.get(Emoji.emoji['bulb']);
export const EMOJ_MOON = Emoji.get(Emoji.emoji['new_moon_with_face']);
export const EMOJ_HALF_MOON = Emoji.get(Emoji.emoji['waning_crescent_moon']);
export const EMOJ_KISS = Emoji.get(Emoji.emoji['kiss']);
export const EMOJ_KISS_HEART = Emoji.get(Emoji.emoji['kissing_heart']);
export const EMOJ_HEART = Emoji.get(Emoji.emoji['heart']);

export const MSG_DISABLED_REASON = `Причина вимкнення - йо#ана русня!${EMOJ_POOP}`;
export const MSG_DISABLED_REGULAR_SUFFIX =
  'Скеруй лють до русні підтримавши українську армію!\n' +
  'Ось один із зручних способів зробити донат: @Donate1024Bot.';
export const MSG_DISABLED_SUSPICIOUS_TIME_SUFFIX =
  'Увага! Контроль наявності світла відбувається за допомогою перевірки Інтернет зв‘язку!\n' +
  'У разі проблем з Інтернетом бот може видавати невірну інформацію (повідомляти про відключення світла, коли світло насправді є)!';

export const MSG_LAUNCH_DOC_LINK =
  '<a href="https://zd333.github.io/electro_bot/doc/launch-bot-for-my-place.html">Як ти можеш запустити такого бота для власної локації без всякого програмування</a>';

export const RESP_START = (params: {
  readonly place: string;
  readonly listedBotsMessage: string;
}) =>
  `Привіт! Цей бот допомогає моніторити ситуацію зі світлом (електроенергією) в ${params.place}.\n\n` +
  `${MSG_LAUNCH_DOC_LINK}\n\n` +
  `За допомогою команди /current ти завжди можеш дізнатися чи є зараз на локації світло і як довго це триває.\n\n` +
  `Команда /subscribe дозволяє підписатися на сповіщення щодо зміни ситуації (відключення/включення).\n\n` +
  `За допомогою команди /stats можна переглянути статистику (звіт по включенням/` +
  `відключенням за поточну і попередню добу, сумарний час наявності/відсутності світла).\n\n` +
  `Контроль наявності світла відбувається за допомогою перевірки Інтернет зв‘язку з провайдером ${params.place}. Зауваж, що в разі проблем з Інтернетом бот може видавати невірну інформацію.\n\n` +
  `Зроблено з ${EMOJ_HEART} @oleksandr_changli\n\n` +
  `https://www.instagram.com/oleksandr_changli/\n\n` +
  params.listedBotsMessage +
  `${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
export const RESP_NO_CURRENT_INFO = (params: { readonly place: string }) =>
  `Нажаль, наразі інформація щодо наявності світла в ${params.place} відсутня.`;
export const RESP_CURRENTLY_AVAILABLE = (params: {
  readonly when: string;
  readonly howLong: string;
  readonly place: string;
}) =>
  `${EMOJ_BULB} Наразі все добре - світло в ${params.place} є!\nВключення відбулося ${params.when}.\n` +
  `Світло є вже ${params.howLong}.\nСлава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
export const RESP_CURRENTLY_UNAVAILABLE = (params: {
  readonly when: string;
  readonly howLong: string;
  readonly place: string;
}) =>
  `${EMOJ_MOON} Нажаль, наразі світла в ${params.place} нема.\nВимкнення відбулося ${params.when}.\n` +
  `Світло відсутнє вже ${params.howLong}.\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_REGULAR_SUFFIX}`;
export const RESP_SUBSCRIPTION_CREATED = (params: { readonly place: string }) =>
  `Підписка створена - ти будеш отримувати повідомлення кожного разу після зміни ситуації зі світлом в ${params.place}.\n` +
  `Ти завжди можеш відписатися за допомогою команди /unsubscribe.`;
export const RESP_SUBSCRIPTION_ALREADY_EXISTS = (params: {
  readonly place: string;
}) =>
  `Підписка вже створена і ти вже отримуєш повідомлення кожного разу після зміни ситуації зі світлом в ${params.place}.\n` +
  `Ти завжди можеш відписатися за допомогою команди /unsubscribe.`;
export const RESP_UNSUBSCRIBED = (params: { readonly place: string }) =>
  `Підписка скасована - ти більше не будеш отримувати повідомлення щодо зміни ситуації зі світлом в ${params.place}.`;
export const RESP_WAS_NOT_SUBSCRIBED = (params: { readonly place: string }) =>
  `Підписка і так відсутня, ти зараз не отримуєш повідомлення щодо зміни ситуації зі світлом в ${params.place}.`;
export const RESP_ABOUT = (params: { readonly listedBotsMessage: string }) =>
  `Версія ${VERSION}\n\n` +
  `Зроблено з ${EMOJ_HEART} @oleksandr_changli\n\n` +
  `https://www.instagram.com/oleksandr_changli/\n\n` +
  `${MSG_LAUNCH_DOC_LINK}\n\n` +
  params.listedBotsMessage +
  `Якщо тобі подобається цей бот - можеш подякувати донатом на підтримку української армії @Donate1024Bot.\n\n`;
export const RESP_ENABLED_SHORT = (params: {
  readonly when: string;
  readonly place: string;
}) =>
  `${EMOJ_BULB} ${params.when}\nЮхууу, світло в ${params.place} включили!\n\nСлава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
export const RESP_DISABLED_SHORT = (params: {
  readonly when: string;
  readonly place: string;
}) =>
  `${EMOJ_MOON} ${params.when}\nЙой, світло в ${params} вимкнено!\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_REGULAR_SUFFIX}`;
export const RESP_ENABLED_DETAILED = (params: {
  readonly when: string;
  readonly howLong: string;
  readonly place: string;
}) =>
  `${EMOJ_BULB} ${params.when}\nЮхууу, світло в ${params.place} включили!\nСвітло було відсутнє ${params.howLong}.\n\n` +
  `Слава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
export const RESP_DISABLED_DETAILED = (params: {
  readonly when: string;
  readonly howLong: string;
  readonly place: string;
}) =>
  `${EMOJ_MOON} ${params.when}\nЙой, світло в ${params.place} вимкнено!\n` +
  `Ми насолоджувалися світлом ${params.howLong}.\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_REGULAR_SUFFIX}`;
export const RESP_DISABLED_SUSPICIOUS = (params: {
  readonly when: string;
  readonly place: string;
}) =>
  `${EMOJ_HALF_MOON} ${params.when}\nКарамба, можливо світло в ${params.place} вимкнено!\n\n` +
  MSG_DISABLED_SUSPICIOUS_TIME_SUFFIX;
export const RESP_PREVIOUS_MONTH_SUMMARY = (params: {
  readonly statsMessage: string;
}) =>
  `${EMOJ_HALF_MOON}Привіт, на зв‘язку світлобот!\n\n` +
  // TODO: rephrase so that it works not only for the first month
  `Ось і закінчився черговий місяць, в якому електрика і світло набули для нас нового значення.\n\n` +
  params.statsMessage +
  '\n\n' +
  `Не сумуй, що час пролетів так швидко, адже тепер ми на місяць ближче до Перемоги!\n\n` +
  `Посміхайся, радій життю, ЗАЙМАЙСЯ ВАЖКОЮ АТЛЕТИКОЮ ${EMOJ_HEART} та не забувай підтримувати ЗСУ!\n\n` +
  `${EMOJ_KISS_HEART}${EMOJ_KISS_HEART}${EMOJ_KISS_HEART}\n` +
  `${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
