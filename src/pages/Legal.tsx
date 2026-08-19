import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { haptic } from '../utils/haptics';
import { Icon } from '../components/Icon';
import { EASE_OUT, fadeUp, staggerContainer } from '../utils/motion';

/**
 * Юридические документы. Собираем ФИО, телефон и адрес — по 152-ФЗ нужны
 * политика обработки ПДн и согласие, по закону о защите прав потребителей —
 * оферта с условиями доставки, оплаты и возврата.
 *
 * ВНИМАНИЕ: реквизиты продавца — заглушки. Перед запуском заказчик подставляет
 * свои ИП/ИНН/адрес/почту, иначе документы юридической силы не имеют.
 */
const SELLER = {
  name: 'ИП ______________________',
  inn: 'ИНН ____________',
  address: '______________________',
  email: 'hello@mishkin.example',
  phone: '+7 (___) ___-__-__',
};

interface Section {
  id: string;
  icon: 'receipt_long' | 'shield' | 'shipping' | 'card';
  title: string;
  body: Array<string | { list: string[] }>;
}

const SECTIONS: Section[] = [
  {
    id: 'offer',
    icon: 'receipt_long',
    title: 'Публичная оферта',
    body: [
      `Продавец: ${SELLER.name}, ${SELLER.inn}, адрес: ${SELLER.address}. Связь: ${SELLER.email}, ${SELLER.phone}.`,
      'Оформляя заказ в мини-приложении MISHKIN, покупатель принимает условия настоящей оферты. Договор считается заключённым с момента подтверждения заказа.',
      'Товар — ароматические свечи ручной работы. Внешний вид изделия может незначительно отличаться от фотографий: каждая свеча заливается вручную.',
      'Цены указаны в рублях и включают все налоги. Стоимость доставки рассчитывается при оформлении и отображается отдельной строкой до оплаты.',
    ],
  },
  {
    id: 'payment',
    icon: 'card',
    title: 'Оплата',
    body: [
      'Онлайн-оплата проводится через ЮKassa (АО «ЮMoney»). Реквизиты карты вводятся на стороне платёжного сервиса — магазин их не получает и не хранит.',
      'Доступные способы: банковская карта, СБП, ЮMoney. Чек направляется на указанный при оплате контакт.',
      'Альтернатива — согласовать оплату с менеджером после оформления заказа.',
    ],
  },
  {
    id: 'delivery',
    icon: 'shipping',
    title: 'Доставка и возврат',
    body: [
      'Отправка в течение 1–3 рабочих дней после оплаты. Способы: СДЭК, Почта России, Boxberry, самовывоз.',
      'Покупатель вправе отказаться от товара до его передачи, а после получения — в течение 7 дней, если товар сохранил потребительские свойства и товарный вид (ст. 26.1 Закона «О защите прав потребителей»).',
      'Возврат денежных средств производится тем же способом, которым была произведена оплата, в течение 10 дней с момента получения требования.',
      'Если свеча повреждена при доставке — пришлите фото в чат, заменим или вернём деньги.',
    ],
  },
  {
    id: 'privacy',
    icon: 'shield',
    title: 'Обработка персональных данных',
    body: [
      `Оператор персональных данных: ${SELLER.name}.`,
      'Какие данные собираем и зачем:',
      {
        list: [
          'имя, телефон, город, адрес, индекс — чтобы собрать и доставить заказ;',
          'Telegram ID и username — чтобы связать заказ с вашим аккаунтом и написать о статусе;',
          'состав и сумма заказа — для исполнения договора и бухгалтерского учёта.',
        ],
      },
      'Основание обработки — заключение и исполнение договора купли-продажи, а также ваше согласие, которое вы даёте галочкой при оформлении.',
      'Данные передаются только тем, без кого заказ не доедет: платёжному сервису (ЮKassa) и службе доставки. Третьим лицам для рекламы данные не передаются.',
      'Срок хранения — 3 года с момента последнего заказа либо до отзыва согласия. Отозвать согласие и запросить удаление данных можно письмом на ' + SELLER.email + '.',
      'Мы не собираем биометрию, не профилируем и не принимаем решений автоматически.',
    ],
  },
];

export function Legal() {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>('offer');

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light px-4 pb-nav-safe pt-[calc(var(--app-top)+1.5rem)]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <header className="mb-6 flex items-center gap-4">
        <button
          onClick={() => { haptic.tap(); navigate(-1); }}
          aria-label="Назад"
          className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90"
        >
          <Icon name="arrow_back" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">Документы</h1>
          <p className="text-2xs text-text-sub">Оферта, оплата, доставка, персональные данные</p>
        </div>
      </header>

      <motion.div
        className="flex flex-col gap-3"
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
      >
        {SECTIONS.map((section) => {
          const open = openId === section.id;
          return (
            <motion.div key={section.id} variants={fadeUp} className="card overflow-hidden">
              <button
                className="flex w-full items-center gap-3 p-4 text-left"
                onClick={() => { haptic.select(); setOpenId(open ? null : section.id); }}
                aria-expanded={open}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={section.icon === 'shield' ? 'admin' : section.icon} size={17} />
                </span>
                <span className="flex-1 font-display text-base font-bold text-text-main">{section.title}</span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-text-sub">
                  <Icon name="chevron_down" size={18} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.26, ease: EASE_OUT }}
                    className="overflow-hidden border-t border-line/60"
                  >
                    <div className="flex flex-col gap-3 p-4 text-[13px] leading-relaxed text-text-sub">
                      {section.body.map((block, i) =>
                        typeof block === 'string' ? (
                          <p key={i}>{block}</p>
                        ) : (
                          <ul key={i} className="flex flex-col gap-1.5 pl-4">
                            {block.list.map((item, j) => (
                              <li key={j} className="list-disc">{item}</li>
                            ))}
                          </ul>
                        ),
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>

      <p className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 p-3.5 text-2xs leading-relaxed text-amber-800">
        <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
        Черновик документов. Реквизиты продавца (ИП, ИНН, адрес, почта) нужно заполнить
        до запуска — иначе оферта и политика не имеют юридической силы.
      </p>
    </motion.div>
  );
}
