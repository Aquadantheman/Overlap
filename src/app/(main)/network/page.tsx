"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { buildNetworkGraph, NetworkGraph as NetworkGraphData, GraphNode } from "@/lib/graph/networkGraph"
import NetworkGraph from "@/components/NetworkGraph"

type ViewState = "loading" | "no-profile" | "empty" | "has-data"

export default function NetworkPage() {
  const [state, setState] = useState<ViewState>("loading")
  const [graphData, setGraphData] = useState<NetworkGraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = "/signin"
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single()

      if (!profile) {
        setState("no-profile")
        return
      }

      const graph = await buildNetworkGraph(user.id)

      if (!graph || graph.nodes.length <= 1) {
        setState("empty")
        return
      }

      setGraphData(graph)
      setState("has-data")
    }

    loadData()
  }, [])

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
      </div>
    )
  }

  if (state === "no-profile") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-medium text-stone-900">Almost there</h1>
          <p className="mt-2 text-stone-500 text-sm">
            Complete your profile to see your network.
          </p>
          <a
            href="/onboarding"
            className="mt-6 inline-block px-6 py-3 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-all"
          >
            Finish setup
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <a
              href="/overlap"
              className="text-stone-400 text-sm hover:text-stone-600 transition-colors"
            >
              Back to overlap
            </a>
            <h1 className="text-2xl font-medium text-stone-900 tracking-tight mt-2">
              Your network
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              How you connect to others through shared interests
            </p>
          </div>
        </div>

        {state === "empty" ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-stone-400 text-lg">...</span>
            </div>
            <h2 className="text-lg font-medium text-stone-900">No connections yet</h2>
            <p className="mt-2 text-stone-500 text-sm leading-relaxed max-w-xs mx-auto">
              When people nearby share your interests, they'll appear in your network.
            </p>
          </div>
        ) : graphData && (
          <div className="flex flex-col gap-6">
            {/* Graph */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <NetworkGraph
                data={graphData}
                width={800}
                height={500}
                onNodeClick={handleNodeClick}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-stone-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-medium text-stone-900">
                  {graphData.nodes.length}
                </p>
                <p className="text-stone-500 text-sm">
                  {graphData.nodes.length === 1 ? "person" : "people"} in network
                </p>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-medium text-stone-900">
                  {graphData.edges.length}
                </p>
                <p className="text-stone-500 text-sm">
                  {graphData.edges.length === 1 ? "connection" : "connections"}
                </p>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-medium text-stone-900">
                  {graphData.edges.reduce((sum, e) => sum + e.weight, 0)}
                </p>
                <p className="text-stone-500 text-sm">shared activities</p>
              </div>
            </div>

            {/* Selected node details */}
            {selectedNode && (
              <div className="bg-white border border-stone-200 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-stone-900 font-medium">
                      @{selectedNode.handle}
                      {selectedNode.isCurrentUser && (
                        <span className="ml-2 text-stone-400 text-sm">(you)</span>
                      )}
                    </p>
                    <p className="text-stone-500 text-sm mt-1">
                      {selectedNode.activityCount} {selectedNode.activityCount === 1 ? "activity" : "activities"},{" "}
                      {selectedNode.connectionCount} {selectedNode.connectionCount === 1 ? "connection" : "connections"}
                    </p>
                  </div>
                  {!selectedNode.isCurrentUser && (
                    <a
                      href="/overlap"
                      className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-all"
                    >
                      View overlap
                    </a>
                  )}
                </div>

                {/* Shared activities with this node */}
                {!selectedNode.isCurrentUser && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                      Shared activities
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {graphData.edges
                        .filter(
                          (e) =>
                            (e.source === selectedNode.id && e.target === graphData.currentUserId) ||
                            (e.target === selectedNode.id && e.source === graphData.currentUserId)
                        )
                        .flatMap((e) => e.sharedActivities)
                        .map((activity, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-stone-100 text-stone-600 rounded-lg text-sm"
                          >
                            {activity}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
