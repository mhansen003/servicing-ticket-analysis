'use client';

import { X, Award, TrendingUp, Users, Heart, Ear, MessageCircle, Shield, Info } from 'lucide-react';

interface AgentGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentGradingModal({ isOpen, onClose }: AgentGradingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#131a29] rounded-2xl border border-white/[0.08] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Award className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">How Are Agents Graded?</h2>
              <p className="text-sm text-gray-400">Understanding our agent performance evaluation system</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Core Philosophy */}
          <div className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3 mb-3">
              <Info className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Core Philosophy</h3>
                <p className="text-gray-300 leading-relaxed">
                  <strong className="text-blue-400">Critical Distinction:</strong> Agent performance is evaluated based on{' '}
                  <span className="text-emerald-400 font-semibold">how well they handle the call</span>, not on the{' '}
                  <span className="text-gray-400">customer's emotional state</span>. An upset customer does not automatically
                  mean poor agent performance. In fact, skilled de-escalation in difficult situations often results in our
                  highest ratings.
                </p>
              </div>
            </div>
          </div>

          {/* Sentiment vs Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
              <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                NOT Graded On:
              </h4>
              <ul className="space-y-1.5 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400">×</span>
                  <span>Customer's initial emotional state</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">×</span>
                  <span>Call sentiment (positive/negative/neutral)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">×</span>
                  <span>Whether the customer's problem was resolved</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">×</span>
                  <span>Factors outside agent control (policy, system issues)</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Graded On:
              </h4>
              <ul className="space-y-1.5 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Agent's professionalism and courtesy</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>How well they listened and understood the issue</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Communication clarity and helpfulness</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>De-escalation skills in difficult situations</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Evaluation Criteria */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Six Key Evaluation Criteria
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Professionalism */}
              <div className="p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4 text-blue-400" />
                  <h4 className="font-semibold text-white">Professionalism</h4>
                  <span className="ml-auto text-xs text-gray-500">Weight: 3.0×</span>
                </div>
                <p className="text-sm text-gray-400">
                  Courteous tone, appropriate language, respectful demeanor throughout the call.
                  Maintained composure regardless of customer emotion.
                </p>
              </div>

              {/* Empathy */}
              <div className="p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-pink-400" />
                  <h4 className="font-semibold text-white">Empathy</h4>
                  <span className="ml-auto text-xs text-gray-500">Weight: 2.0×</span>
                </div>
                <p className="text-sm text-gray-400">
                  Demonstrated understanding of customer's feelings and situation.
                  Showed genuine care and acknowledgment of concerns.
                </p>
              </div>

              {/* Active Listening */}
              <div className="p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Ear className="h-4 w-4 text-purple-400" />
                  <h4 className="font-semibold text-white">Active Listening</h4>
                  <span className="ml-auto text-xs text-gray-500">Weight: 2.0×</span>
                </div>
                <p className="text-sm text-gray-400">
                  Attentive to customer needs, asked clarifying questions,
                  avoided interrupting, demonstrated full understanding of the issue.
                </p>
              </div>

              {/* Communication Clarity */}
              <div className="p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="h-4 w-4 text-cyan-400" />
                  <h4 className="font-semibold text-white">Communication Clarity</h4>
                  <span className="ml-auto text-xs text-gray-500">Weight: 1.5×</span>
                </div>
                <p className="text-sm text-gray-400">
                  Clear explanations, avoided jargon, ensured customer understood next steps.
                  Articulate and easy to follow.
                </p>
              </div>

              {/* De-escalation */}
              <div className="p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <h4 className="font-semibold text-white">De-escalation</h4>
                  <span className="ml-auto text-xs text-gray-500">Weight: 1.5×</span>
                </div>
                <p className="text-sm text-gray-400">
                  Ability to calm frustrated customers, redirect negative situations,
                  maintain control of difficult conversations professionally.
                </p>
              </div>

              {/* Problem Resolution Effort */}
              <div className="p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                  <h4 className="font-semibold text-white">Resolution Effort</h4>
                  <span className="ml-auto text-xs text-gray-500">Weight: 2.0×</span>
                </div>
                <p className="text-sm text-gray-400">
                  Effort to help resolve the issue, resourcefulness,
                  taking ownership even when immediate resolution isn't possible.
                </p>
              </div>
            </div>
          </div>

          {/* Scoring Scale */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4">Performance Rating Scale</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-2xl font-bold text-emerald-400">5</span>
                <div>
                  <h5 className="font-semibold text-emerald-300">Exemplary</h5>
                  <p className="text-sm text-gray-400">
                    Went above and beyond. Exceptional handling that sets the standard for others.
                    Would be used as a training example.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <span className="text-2xl font-bold text-blue-400">4</span>
                <div>
                  <h5 className="font-semibold text-blue-300">Professional</h5>
                  <p className="text-sm text-gray-400">
                    Proper tone, helpful, courteous. No issues. This is the expected standard
                    of performance for all agents.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                <span className="text-2xl font-bold text-gray-400">3</span>
                <div>
                  <h5 className="font-semibold text-gray-300">Adequate</h5>
                  <p className="text-sm text-gray-400">
                    Got the job done with minor issues. Functional but with room for improvement
                    in tone, empathy, or clarity.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <span className="text-2xl font-bold text-amber-400">2</span>
                <div>
                  <h5 className="font-semibold text-amber-300">Below Standard</h5>
                  <p className="text-sm text-gray-400">
                    Noticeable problems in handling. May have been short, dismissive, or unclear.
                    Coaching recommended.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="text-2xl font-bold text-red-400">1</span>
                <div>
                  <h5 className="font-semibold text-red-300">Unprofessional</h5>
                  <p className="text-sm text-gray-400">
                    Rude, dismissive, or caused additional problems. Violated professional standards.
                    Immediate intervention required.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Final Score Calculation */}
          <div className="p-5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-3">How Final Scores Are Calculated</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <p>
                Each agent is evaluated across <strong className="text-white">8 calls minimum</strong> to ensure
                statistical reliability. The six criteria are scored 1-5 for each call, then:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Each criteria score is multiplied by its weight (shown above)</li>
                <li>Weighted scores are averaged across all evaluated calls</li>
                <li>Final score is normalized to a 0-100 scale</li>
                <li>Agents with fewer than 20 total calls are marked "unranked" for statistical validity</li>
              </ol>
              <div className="mt-4 p-3 bg-[#0a0e17] rounded-lg">
                <p className="text-xs text-gray-500 italic">
                  Example: An agent who receives mostly 4s (Professional) with occasional 5s (Exemplary)
                  will score in the 80-90 range, while an agent with mostly 3s (Adequate) will score in the 60-70 range.
                </p>
              </div>
            </div>
          </div>

          {/* Key Takeaway */}
          <div className="p-5 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Key Takeaway</h3>
            <p className="text-gray-300 leading-relaxed">
              <strong className="text-emerald-400">Agent performance is about controllable behaviors</strong> –
              professionalism, empathy, communication, and effort. A perfect agent can receive a challenging call
              from an angry customer and still earn a 5/5 rating by handling it with exceptional care, de-escalation,
              and professionalism. Conversely, an agent on an easy, positive call can still receive a low score
              if they're dismissive, unclear, or unprofessional.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-4 bg-[#0a0e17] border-t border-white/[0.06] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
