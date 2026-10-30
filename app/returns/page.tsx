import { company } from "@/lib/company";
import { ReturnRequestForm } from "@/components/ReturnRequestForm";

const sections: { title: string; body: string[]; list?: string[] }[] = [
  {
    title: "1. 14-Day Right to Return",
    body: [
      "For eligible standard products purchased online by EU consumers, you may have the right to withdraw from your purchase within 14 days from the date you receive the goods, without giving a specific reason.",
      "To exercise this right, please contact us within the applicable withdrawal period through our official customer-support contact.",
      "The product should be returned within the applicable legal period and should be handled with reasonable care. Where permitted by applicable law, the customer may be responsible for the direct cost of returning a product after a change-of-mind return.",
    ],
  },
  {
    title: "2. Damaged During Delivery",
    body: [
      "If your package arrives visibly damaged, please contact us as soon as possible and provide photographs of:",
    ],
    list: ["The outer packaging", "Shipping labels", "The damaged product", "Any damaged or missing components"],
  },
  {
    title: "3. Wrong or Incorrect Product",
    body: [
      "If you receive a product that is materially different from what you ordered, such as the wrong model, size, specification or quantity, please contact us promptly.",
      "We will investigate the issue and, where applicable, arrange an appropriate remedy such as replacement, repair or refund.",
    ],
  },
  {
    title: "4. Manufacturing Defects & Non-Conforming Products",
    body: [
      "Our products are inspected before shipment.",
      "If a product has a manufacturing defect or does not conform to the contract, description or agreed specifications, please contact us with photographs, videos and your order information.",
      "Where required by applicable law, we will provide the appropriate remedy, which may include repair, replacement, price reduction or refund.",
      "For EU consumers, statutory consumer guarantee rights apply in accordance with applicable EU and national law.",
    ],
  },
  {
    title: "5. Custom-Made & Personalised Products",
    body: [
      "Some MARINA MUSE INTERNATIONAL products may be manufactured specifically according to a customer's individual measurements, specifications, engraving, design, configuration or other personalised requirements.",
      "Certain personalised or custom-made goods may be excluded from the standard 14-day withdrawal right under applicable EU consumer law.",
      "However, this does not affect any mandatory legal rights relating to defective, damaged or non-conforming goods.",
      "Before production begins, we may confirm the customer's specifications to help avoid errors.",
    ],
  },
  {
    title: "6. Exchange Policy",
    body: [
      "For eligible standard products, an exchange may be available subject to product availability and applicable consumer law.",
      "If you receive an incorrect, damaged or defective product, please contact us before sending anything back. We will provide return instructions and determine the appropriate solution.",
      "Custom-made or personalised products may not be eligible for exchange simply because the customer changes their mind, where applicable law permits this.",
    ],
  },
  {
    title: "7. Refunds",
    body: [
      "Once a return or cancellation is accepted, any refund will be processed in accordance with applicable law.",
      "Where applicable, refunds will normally be made using the original payment method.",
      "Depending on the circumstances of the return, applicable law may determine which shipping costs are refundable and who is responsible for return shipping costs.",
      "We will not unlawfully withhold a refund where the customer has a mandatory statutory right to one.",
    ],
  },
  {
    title: "8. Product Condition for Change-of-Mind Returns",
    body: [
      "For a change-of-mind return, please keep the product in a condition that allows it to be inspected.",
      "Where permitted by applicable law, you may be responsible for any diminished value caused by handling beyond what is reasonably necessary to establish the nature, characteristics and functioning of the goods.",
      "Please return the product with its original accessories, components and packaging where reasonably possible.",
    ],
  },
  {
    title: "9. Return Procedure",
    body: ["To request a return, please provide:"],
    list: ["Order Number", "Customer Name", "Product Name", "Reason for Return", "Photographs or Video, where relevant"],
  },
  {
    title: "10. International Orders",
    body: [
      "For customers outside the European Union, return, refund, customs, duties and shipping arrangements may differ depending on the destination country and applicable law.",
      "Any mandatory consumer rights applicable to the customer's country remain unaffected.",
      "Import duties, taxes and customs charges may be treated according to the applicable destination-country rules and the terms displayed at the time of purchase.",
    ],
  },
  {
    title: "11. Handcrafted Products",
    body: [
      "Many MARINA MUSE INTERNATIONAL products are handcrafted.",
      "Minor variations in natural wood, brass finish, leather, colour, texture or handcrafted detailing may occur and can be part of the character of a handmade product.",
      "Such ordinary handcrafted variations are not automatically considered defects.",
      "However, this does not affect your statutory rights where a product is defective or does not conform to the agreed description or specifications.",
    ],
  },
  {
    title: "12. Contact Us",
    body: [
      "For any return, exchange, refund or product issue, please contact MARINA MUSE INTERNATIONAL through the customer-support contact details provided on our website.",
      "Please include your order number so that we can process your request efficiently.",
    ],
  },
];

const wholesaleSections: { title: string; body: string[]; list?: string[]; after?: string[] }[] = [
  {
    title: "1. Sample Approval Before Bulk Orders",
    body: [
      "Wholesale customers may request a sample before confirming a bulk order.",
      "Bulk production and dispatch will proceed according to the sample approved by the customer and the mutually agreed product specifications. Customers are responsible for reviewing the sample carefully before approving bulk production.",
    ],
  },
  {
    title: "2. Product Quality & Order Specifications",
    body: [
      "All wholesale orders will be manufactured or prepared according to the agreed specifications, including product design, material, dimensions, quantity, finish, and approved customization.",
      "Any special requirements must be confirmed in writing before production begins.",
    ],
  },
  {
    title: "3. Damaged, Defective or Incorrect Products",
    body: [
      "If a wholesale order arrives damaged, defective, incorrect, or materially different from the agreed specifications, the customer must notify MARINA MUSE INTERNATIONAL promptly after receiving the goods.",
      "Customers should provide:",
    ],
    list: [
      "Wholesale order number and relevant order details.",
      "Clear photographs or videos showing the issue.",
      "A description of the damage, defect, or discrepancy.",
    ],
    after: [
      "After verification and any necessary inspection, an appropriate resolution may include repair, replacement, or a full or partial refund, depending on the circumstances, the agreed order terms, and applicable law.",
    ],
  },
  {
    title: "4. Returns & Exchanges",
    body: [
      "All wholesale returns and exchanges require prior written authorization from MARINA MUSE INTERNATIONAL.",
      "Customers must not ship products back without receiving return instructions. Unauthorized returns may be refused where permitted by applicable law.",
      "Approved returns must follow the return instructions and conditions communicated by our team.",
    ],
  },
  {
    title: "5. Sample-Approved Bulk Orders",
    body: [
      "Once a customer has approved the sample and confirmed the bulk order, returns or exchanges due to a change of mind, change of preference, or reasons unrelated to an agreed product defect will not normally be accepted.",
      "Any exceptions must be agreed in writing, subject to applicable law.",
    ],
  },
  {
    title: "6. Customized & Made-to-Order Products",
    body: [
      "Customized, personalized, and specially manufactured wholesale products are generally not eligible for return or cancellation due to a change of mind once production has commenced.",
      "This condition does not exclude claims relating to damaged, defective, incorrect, or non-conforming products, or any mandatory rights available under applicable law.",
    ],
  },
  {
    title: "7. Order Cancellation",
    body: ["Cancellation requests must be submitted in writing."],
    list: [
      "Before production: Cancellation may be considered subject to written confirmation.",
      "During production or customization: Cancellation may not be possible once work has commenced.",
      "After dispatch: Cancellation is generally not available through the order cancellation process.",
    ],
    after: [
      "Any applicable refund, cancellation charges, or other adjustments will be determined according to the agreed order terms and applicable law.",
    ],
  },
  {
    title: "8. Return Shipping, Customs & Duties",
    body: [
      "For approved returns arising from verified defects, damage, or errors attributable to the seller, return shipping costs will be handled according to the agreed order terms and applicable law.",
      "For other approved returns, the customer may be responsible for return shipping, customs duties, import taxes, and related charges, where agreed in writing and permitted by law.",
      "International customers should confirm the return shipping and customs arrangements before sending any goods back.",
    ],
  },
  {
    title: "9. Refund Processing",
    body: [
      "Approved refunds will be processed through the original or another mutually agreed payment method, subject to payment provider requirements.",
      "Where necessary, refunds will be processed after the claim has been verified and the required inspection or return has been completed.",
      "The time taken for the refunded amount to appear in the customer's account may vary depending on the payment provider and banking procedures.",
    ],
  },
  {
    title: "10. How to Submit a Return or Refund Request",
    body: ["To submit a claim, customers should contact MARINA MUSE INTERNATIONAL and provide:"],
    list: [
      "Order number.",
      "Customer or business name.",
      "Description of the issue.",
      "Supporting photographs or videos.",
      "Preferred resolution, such as repair, replacement, or refund.",
    ],
    after: ["Our team will review the request and communicate the next steps."],
  },
  {
    title: "11. Wholesale Order Agreement",
    body: [
      "The approved sample, purchase order, product specifications, agreed quantity, payment terms, production arrangements, and shipping terms form part of the wholesale order agreement.",
      "Any special return, exchange, or refund arrangement must be confirmed in writing by both parties.",
    ],
  },
  {
    title: "12. Applicable Law & Customer Rights",
    body: [
      "This policy is subject to applicable laws and regulations. Nothing in this policy excludes or restricts any mandatory legal rights or remedies available to customers.",
    ],
  },
];

export default function ReturnsPage() {
  return (
    <div className="bg-[#FAF7F2]">
      <article className="px-5 py-10 md:py-14">
        <div className="mx-auto max-w-[860px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C9A84C]">Policy</p>
          <h1 className="mt-2 font-serif text-[1.65rem] text-navy-900 md:text-4xl">
            Return, Refund &amp; Exchange Policy
          </h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#8C6E28]">{company.name}</p>
          <p className="mt-5 leading-relaxed text-navy-600">
            We want every customer to feel confident when purchasing from {company.name}. Every product is carefully
            inspected and securely packed before shipment.
          </p>
          <p className="mt-4 leading-relaxed text-navy-600">
            For customers in the European Union, mandatory consumer rights apply in addition to the policies below.
            Nothing in this policy limits any legal rights that cannot legally be excluded or restricted.
          </p>
          <p className="mt-4 leading-relaxed text-navy-600">
            Buying wholesale? See the{" "}
            <a href="#wholesale" className="font-semibold text-[#8C6E28] underline">
              Wholesale Returns, Refunds &amp; Exchange Policy
            </a>
            .
          </p>

          {sections.map((s) => (
            <section key={s.title} className="mt-9">
              <h2 className="font-serif text-xl text-navy-900 md:text-2xl">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p.slice(0, 48)} className="mt-3 leading-relaxed text-navy-600">
                  {p}
                </p>
              ))}
              {s.list ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-navy-700">
                  {s.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {s.title.startsWith("2.") ? (
                <p className="mt-3 leading-relaxed text-navy-600">
                  We will review the case and provide an appropriate solution, which may include repair, replacement or
                  refund, subject to applicable consumer law.
                </p>
              ) : null}
              {s.title.startsWith("9.") ? (
                <>
                  <p className="mt-3 leading-relaxed text-navy-600">
                    Our customer-support team will provide the appropriate return instructions.
                  </p>
                  <p className="mt-3 leading-relaxed text-navy-600">
                    Please do not send a product to an address without first receiving return instructions from{" "}
                    {company.name.toUpperCase()}.
                  </p>
                </>
              ) : null}
            </section>
          ))}

          <section id="wholesale" className="mt-14 scroll-mt-28 border-t border-[#e6dfd2] pt-10">
            <h2 className="font-serif text-[1.5rem] text-navy-900 md:text-3xl">
              Wholesale Returns, Refunds &amp; Exchange Policy
            </h2>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#8C6E28]">{company.name}</p>
            <p className="mt-5 leading-relaxed text-navy-600">
              At {company.name.toUpperCase()}, we aim to provide premium-quality, factory-made brass products and a
              reliable wholesale purchasing experience. Our wholesale return, refund, and exchange policy is designed to
              ensure clarity, quality assurance, and fair treatment for both parties.
            </p>
            {wholesaleSections.map((s) => (
              <div key={s.title} className="mt-8">
                <h3 className="font-serif text-lg text-navy-900 md:text-xl">{s.title}</h3>
                {s.body.map((p) => (
                  <p key={p.slice(0, 48)} className="mt-3 leading-relaxed text-navy-600">
                    {p}
                  </p>
                ))}
                {s.list ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-navy-700">
                    {s.list.map((item) => {
                      const cut = item.indexOf(": ");
                      const label = cut > 0 ? item.slice(0, cut) : null;
                      const rest = cut > 0 ? item.slice(cut + 2) : item;
                      return (
                        <li key={item}>
                          {label ? <span className="font-semibold">{label}: </span> : null}
                          {rest}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {s.after?.map((p) => (
                  <p key={p.slice(0, 48)} className="mt-3 leading-relaxed text-navy-600">
                    {p}
                  </p>
                ))}
              </div>
            ))}
            <p className="mt-8 leading-relaxed text-navy-600">
              {company.name.toUpperCase()} reserves the right to assess wholesale claims individually and provide a fair
              resolution in accordance with the agreed order terms and applicable law.
            </p>
            <div className="mt-10 text-center">
              <p className="font-serif text-xl text-navy-900">{company.name.toUpperCase()}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8C6E28]">
                Handcrafted in Our Own Factory | Premium Quality | Worldwide Shipping
              </p>
            </div>
          </section>

          <div className="mt-12 border-t border-[#e6dfd2] pt-8 text-center">
            <p className="font-serif text-xl text-navy-900">{company.name}</p>
            <p className="mt-1 text-sm text-navy-600">Handcrafted Brass &amp; Heritage Products</p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8C6E28]">
              Worldwide Shipping | International Customer Support
            </p>
          </div>

          <div className="mt-10">
            <ReturnRequestForm />
          </div>
        </div>
      </article>
    </div>
  );
}
