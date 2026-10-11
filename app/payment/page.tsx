import Link from "next/link";
import {
  BadgeCheck,
  Headset,
  Lock,
  Mail,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { BannerHero } from "@/components/BannerHero";
import { company } from "@/lib/company";
import { getPublicContactEmail } from "@/lib/contact-emails";

const pillars = [
  {
    icon: Lock,
    title: "Safe & Protected Checkout",
    body: "Your payment and personal information are handled through secure payment processing.",
  },
  {
    icon: PackageCheck,
    title: "Order Confirmation",
    body: "After successful payment, you will receive your order confirmation and purchase details.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted Payment Processing",
    body: "Payments are processed through secure checkout and the payment options available on this site.",
  },
  {
    icon: Headset,
    title: "Customer Support",
    body: "Our international customer-support team is available to assist you with payment and order-related questions.",
  },
];

export default function PaymentPage() {
  const supportEmail = getPublicContactEmail();
  return (
    <div className="bg-[#FAF7F2]">
      <BannerHero
        src="/secure-payment-banner.png"
        mobileSrc="/mobile/payment.png"
        alt="Secure International Payment — shop with confidence"
        title="Secure International Payment"
      />

      <section className="px-5 py-10 md:py-14">
        <div className="mx-auto max-w-[900px] text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8C6E28]">Shop with confidence</p>
          <h2 className="mt-3 font-serif text-[1.85rem] text-navy-900 md:text-5xl">Secure International Payment</h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-navy-600 md:text-base">
            Pay through secure checkout using the payment methods available on this page. Your payment information
            is processed securely to help protect your transaction.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-[1100px] gap-4 sm:grid-cols-2">
          {pillars.map((p) => (
            <article key={p.title} className="rounded-2xl bg-white p-6 shadow-soft md:p-8">
              <p.icon className="h-7 w-7 text-[#C9A84C]" />
              <h3 className="mt-4 font-serif text-2xl text-navy-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pb-10 md:pb-14">
        <div className="mx-auto max-w-[1100px] rounded-3xl bg-[#031D38] px-6 py-8 text-cream-100 md:px-10 md:py-10">
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#C9A84C]" />
            <div>
              <h3 className="font-serif text-2xl md:text-3xl">Order confirmation system</h3>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-cream-100/75">
                After a successful payment, the website verifies it on the server before the order
                is confirmed. You then see an Order Confirmation page, receive an email with your order number, product
                details, quantity, amount paid, payment status, shipping address, estimated delivery and support
                contact, and can check status from your account.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-cream-100/80 sm:grid-cols-2">
                {[
                  "Server-side secure checkout verification",
                  "Order created only after payment is verified",
                  "Confirmation email after successful payment",
                  "Order status in your account",
                  "Optional WhatsApp confirmation",
                  "Worldwide shipping & export documents",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A84C]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-start">
            <Link href="/checkout" className="btn-gold w-[15.5rem] px-3 text-center sm:w-[16.5rem]">
              Go to secure checkout
            </Link>
            <Link href="/account/orders" className="btn-outline w-[15.5rem] px-3 text-center sm:w-[16.5rem]">
              View order status
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-[#eee7db] bg-white px-5 py-8">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8C6E28]">
            {company.name}
          </p>
          <p className="text-sm text-navy-700">
            Secure Payment <span className="text-[#C9A84C]">|</span> Worldwide Shipping{" "}
            <span className="text-[#C9A84C]">|</span> International Customer Support
          </p>
          <a href={`mailto:${supportEmail}`} className="inline-flex items-center gap-2 text-sm text-navy-600 hover:text-[#8C6E28]">
            <Mail className="h-4 w-4 text-[#C9A84C]" />
            {supportEmail}
          </a>
        </div>
      </section>
    </div>
  );
}
