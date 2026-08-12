"use client";

import { FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";

const FIELD_LABEL_CLASS =
  "block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15";

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    honeypot: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setStatus({ type: "error", message: "Please fill in all required fields." });
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(formData.email)) {
      setStatus({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          source: "PUBLIC_CONTACT",
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to send your message. Please try again.");
      }

      setStatus({
        type: "success",
        message: "Message sent successfully! We'll get back to you soon.",
      });
      setFormData({ name: "", email: "", subject: "", message: "", honeypot: "" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to send your message.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input
        type="text"
        name="honeypot"
        value={formData.honeypot}
        onChange={(event) =>
          setFormData((prev) => ({ ...prev, honeypot: event.target.value }))
        }
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="name" className={FIELD_LABEL_CLASS}>
            Full Name
          </label>
          <input
            id="name"
            name="name"
            value={formData.name}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="John Doe"
            className={`${INPUT_CLASS} mt-2`}
            required
          />
        </div>

        <div>
          <label htmlFor="email" className={FIELD_LABEL_CLASS}>
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, email: event.target.value }))
            }
            placeholder="john@example.com"
            className={`${INPUT_CLASS} mt-2`}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className={FIELD_LABEL_CLASS}>
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, subject: event.target.value }))
          }
          placeholder="How can we help?"
          className={`${INPUT_CLASS} mt-2`}
          required
        />
      </div>

      <div>
        <label htmlFor="message" className={FIELD_LABEL_CLASS}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, message: event.target.value }))
          }
          placeholder="Tell us more about your inquiry..."
          rows={6}
          className={`${INPUT_CLASS} mt-2 resize-none`}
          required
        />
      </div>

      {status ? (
        <p
          className={`text-sm ${
            status.type === "success" ? "text-green-700" : "text-red-600"
          }`}
          role="status"
        >
          {status.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending..." : "Send Message"}
        {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    </form>
  );
}
