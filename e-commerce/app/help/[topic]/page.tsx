import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/app/components/Container";
import Heading from "@/app/components/Headinng";
import { FiMail, FiMapPin, FiPhone } from "react-icons/fi";

const topics: Record<string, { title: string; intro: string; sections: { title: string; text: string }[] }> = {
  contact: {
    title: "Contact us",
    intro: "Need help choosing a product or checking an order? Get in touch with SGTech.",
    sections: [
      { title: "Product questions", text: "Tell us the product name and what you are looking for. Our team can help you check the details before ordering." },
      { title: "Order support", text: "Have your order ID ready so we can find your purchase. You can find it in Your Orders after signing in." },
    ],
  },
  returns: {
    title: "Returns & exchanges",
    intro: "Contact SGTech to check the return or exchange options for your order.",
    sections: [
      { title: "Before sending an item back", text: "Share your order ID, product name and reason for the request with our support team. Please wait for return instructions before sending an item." },
      { title: "An item arrived damaged or incorrect", text: "Keep the item and packaging, and include clear photos of the issue when contacting us. This helps our team review your request." },
      { title: "Eligibility and next steps", text: "Return eligibility, any applicable costs and the next steps need to be confirmed with our team for your specific order." },
    ],
  },
  shipping: {
    title: "Shipping & delivery",
    intro: "Review your delivery details carefully when placing an order.",
    sections: [
      { title: "Delivery information", text: "Enter your name, phone number and full address at checkout. You can save your delivery information to your profile for future purchases." },
      { title: "Check your order", text: "Sign in and open Your Orders to view the order details and available delivery status." },
      { title: "Delivery questions or address changes", text: "Contact SGTech with your order ID to confirm delivery availability, fees or timing, or to request an address change before dispatch." },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    intro: "Quick answers to help you shop at SGTech.",
    sections: [
      { title: "How do I find a product?", text: "Search for a product or brand in the header. On the shop page, choose a category, select one or more brands, and sort by price or product name. Remove a filter chip or select Clear all filters to start again." },
      { title: "How do I place an order?", text: "Open a product, choose its color and quantity, then add it to your cart. Review your cart, sign in and enter your delivery details at checkout." },
      { title: "Which payment options are shown at checkout?", text: "Checkout includes Cash on Delivery (COD), VNPay, MoMo and card payment through Stripe. Review the selected method before placing your order." },
      { title: "Where can I check my order?", text: "Open the account menu and select Your Orders. Choose an order to see its products, payment information and available delivery status." },
      { title: "I forgot my password. What should I do?", text: "Select Forgot password on the login page. Enter your email address and follow the reset instructions sent to your inbox." },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  return { title: `${topics[topic]?.title ?? "Help"} | SGTech` };
}

export default async function HelpPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const content = Object.hasOwn(topics, topic) ? topics[topic] : undefined;
  if (!content) notFound();

  return (
    <div className="py-8">
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-teal-700">Home</Link><span>/</span><span className="text-slate-700">Customer service</span>
        </nav>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Heading title={content.title} />
            <p className="mt-3 text-base leading-7 text-slate-500">{content.intro}</p>
            <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
              {content.sections.map((section) => topic === "faq" ? (
                <details key={section.title} className="group py-5">
                  <summary className="cursor-pointer text-base font-bold marker:text-teal-600">{section.title}</summary>
                  <p className="mt-3 text-base leading-7 text-slate-600">{section.text}</p>
                </details>
              ) : (
                <section key={section.title} className="py-5">
                  <h2 className="text-lg font-bold">{section.title}</h2>
                  <p className="mt-2 text-base leading-7 text-slate-600">{section.text}</p>
                </section>
              ))}
            </div>
            <Link href="/orders" className="mt-6 inline-block text-base text-teal-700 hover:underline">View your orders</Link>
          </div>
          <aside className="self-start rounded-md border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-bold">Need a hand?</h2>
            <div className="mt-4 space-y-4 text-base">
              <a href="tel:19002004" className="flex items-center gap-3 hover:text-teal-700"><FiPhone className="shrink-0 text-teal-600" />1900 2004</a>
              <a href="mailto:sgtech@gmail.com" className="flex items-center gap-3 break-all hover:text-teal-700"><FiMail className="shrink-0 text-teal-600" />sgtech@gmail.com</a>
              <p className="flex items-start gap-3 leading-7"><FiMapPin className="mt-1 shrink-0 text-teal-600" /><span>387 Bình Thành, Bình Tân, Ho Chi Minh City</span></p>
            </div>
            <nav aria-label="Customer service" className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5">
              {Object.entries(topics).map(([key, item]) => <Link key={key} href={`/help/${key}`} aria-current={topic === key ? "page" : undefined} className={`text-base hover:text-teal-700 ${topic === key ? "font-bold text-teal-700" : "text-slate-600"}`}>{item.title}</Link>)}
            </nav>
          </aside>
        </div>
      </Container>
    </div>
  );
}
